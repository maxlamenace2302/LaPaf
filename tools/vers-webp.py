#!/usr/bin/env python3
"""
Convertit en WebP les photos passees en argument (ou tout assets/ par defaut).

  python3 tools/vers-webp.py                 # tout assets/ (hors _originaux)
  python3 tools/vers-webp.py assets/toto.jpg # un fichier precis

Regles appliquees (identiques a la conversion du 31/08/2026) :
  - plus grand cote ramene a 2000 px maximum
  - qualite 82, method 6
  - rotation EXIF appliquee (sinon les photos iPhone partent de travers)
  - l'original est deplace dans assets/_originaux/ (ignore par git)

Dependances : pip install pillow pillow-heif
(pillow-heif sert aux fichiers HEIC renommes en .jpg par le Finder)
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

RACINE = Path(__file__).resolve().parent.parent
ASSETS = RACINE / "assets"
ARCHIVE = ASSETS / "_originaux"
MAXDIM, QUALITE = 2000, 82


def convertir(src: Path) -> None:
    dst = src.with_suffix(".webp")
    if dst.exists():
        print(f"  ! {dst.name} existe deja — ignore")
        return
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w, h = im.size
    if max(w, h) > MAXDIM:
        r = MAXDIM / max(w, h)
        im = im.resize((round(w * r), round(h * r)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=QUALITE, method=6)
    cible = ARCHIVE / src.relative_to(ASSETS)
    cible.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(cible))
    print(f"  {src.name} -> {dst.name} ({dst.stat().st_size // 1024} Ko)")


def main() -> None:
    args = sys.argv[1:]
    if args:
        sources = [Path(a).resolve() for a in args]
    else:
        sources = [
            p for p in ASSETS.rglob("*")
            if p.suffix.lower() in (".jpg", ".jpeg", ".png")
            and "_originaux" not in p.parts
            and p.name not in ("icon-192.png", "icon-512.png", "apple-touch-icon.png")
        ]
    if not sources:
        print("Rien a convertir.")
        return
    for s in sources:
        convertir(s)
    print("\nPense a referencer le .webp dans le HTML (ou a deposer les photos "
          "d'evenement sous assets/events/<slug>.webp).")


if __name__ == "__main__":
    main()
