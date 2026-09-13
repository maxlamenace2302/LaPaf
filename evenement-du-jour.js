// evenement-du-jour.js
//
// Signale une soirée à thème (ex: karaoké) sur le site public — peut être annoncée
// à l'avance, pas seulement le jour même.
// >>> À éditer à la main, uniquement quand la chef prévient d'un événement. <<<
// Remettre `actif: false` une fois l'événement passé.
//
// `date` (AAAA-MM-JJ) sert à deux choses : afficher "Ce soir" seulement quand c'est
// vraiment le jour J (sinon la vraie date, dans la popup), et prévenir sur
// reservation.html si le visiteur choisit ce jour-là. `texte_bandeau` reste écrit à la
// main : mets-y toi-même la date en toutes lettres si l'événement n'est pas le jour même
// (ex. "Samedi 26 Septembre : ..."), sinon "Ce soir : ..." suffit.
//
// Effets quand actif === true :
//   - un bandeau ancré en haut, visible en permanence, sur index.html, reservation.html
//     ET admin.html
//   - la photo de l'événement entre dans le carrousel du hero (index.html)
//   - une popup avec la photo + le nom s'affiche à l'arrivée sur index.html,
//     une fois par visite (sessionStorage)
//   - sur reservation.html, une note apparaît si la date choisie == `date`
window.EVENEMENT_DU_JOUR = {
  actif: true,
  date: "2026-09-26",
  nom: "Soirée Karaoké",
  image: "assets/events/karaoke.webp",
  texte_bandeau: "🎤 Samedi 26 Septembre: Soirée Karaoké — animation dès 20h",
};

(function () {
  var evt = window.EVENEMENT_DU_JOUR;

  // "2026-09-26" → "samedi 26 septembre" (ou "" si la date est absente/invalide)
  function formatDateFR(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    var s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function isTodayISO(iso) {
    if (!iso) return false;
    var todayParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    return iso === todayParis;
  }

  function renderBandeau() {
    var mount = document.getElementById("bandeau-evenement");
    if (!mount) return;

    if (!evt || !evt.actif || !evt.texte_bandeau) {
      mount.hidden = true;
      document.documentElement.style.setProperty("--bandeau-h", "0px");
      return;
    }

    mount.hidden = false;
    mount.textContent = evt.texte_bandeau;

    // Mesure la vraie hauteur : le texte peut passer sur deux lignes en mobile.
    var setHeight = function () {
      document.documentElement.style.setProperty("--bandeau-h", mount.offsetHeight + "px");
    };
    setHeight();
    window.addEventListener("resize", setHeight);
  }

  function renderHeroCarousel() {
    var media = document.querySelector(".hero__media");
    var baseImg = media && media.querySelector("img");
    if (!media || !baseImg) return; // pas de hero sur cette page (ex: reservation.html)

    baseImg.classList.add("hero__slide", "is-active");

    var extraSlides = [];
    if (evt && evt.actif && evt.image) {
      extraSlides.push({ src: evt.image, alt: evt.nom || "Soirée à thème" });
    }
    extraSlides.push({ src: "assets/salle1.webp", alt: "Salle de l'auberge" });

    var overlay = media.querySelector(".hero__overlay");
    var layers = [baseImg];
    extraSlides.forEach(function (slide) {
      var img = document.createElement("img");
      img.src = slide.src;
      img.alt = slide.alt;
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "hero__slide";
      media.insertBefore(img, overlay);
      layers.push(img);
    });

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (layers.length < 2 || reduceMotion) return; // reste sur la 1ère photo

    var current = 0;
    setInterval(function () {
      layers[current].classList.remove("is-active");
      current = (current + 1) % layers.length;
      layers[current].classList.add("is-active");
    }, 6000);
  }

  function renderEventPopup() {
    var popup = document.getElementById("eventPopup");
    if (!popup) return; // pas de popup sur cette page (ex: reservation.html, admin.html)
    if (!evt || !evt.actif || !evt.image) return;

    // Une seule fois par visite (onglet ouvert) — pas à chaque page vue.
    var dejaVue = false;
    try { dejaVue = sessionStorage.getItem("popupEvenementVu") === "1"; } catch (e) {}
    if (dejaVue) return;

    var img = popup.querySelector(".event-popup__img");
    var title = popup.querySelector(".event-popup__title");
    var eyebrow = popup.querySelector("#eventPopupEyebrow");
    img.src = evt.image;
    img.alt = evt.nom || "Soirée à thème";
    title.textContent = evt.nom || "Une soirée spéciale";
    if (eyebrow) {
      var dateFR = formatDateFR(evt.date);
      eyebrow.textContent = isTodayISO(evt.date) ? "— Ce soir —"
        : dateFR ? "— " + dateFR + " —"
        : "— Événement —"; // pas de date renseignée : on n'invente pas "ce soir"
    }

    var closeBtn = popup.querySelector(".event-popup__close");

    function close() {
      popup.classList.remove("is-open");
      popup.setAttribute("aria-hidden", "true");
      window.setTimeout(function () { popup.hidden = true; }, 300); // laisse le fondu finir
      document.removeEventListener("keydown", onKeydown);
    }
    function onKeydown(e) {
      if (e.key === "Escape") close();
    }

    closeBtn.addEventListener("click", close);
    popup.addEventListener("click", function (e) {
      if (e.target === popup) close(); // clic en dehors de la carte
    });
    document.addEventListener("keydown", onKeydown);

    try { sessionStorage.setItem("popupEvenementVu", "1"); } catch (e) {}

    // Petit délai d'entrée, moins brutal qu'un popup instantané.
    window.setTimeout(function () {
      popup.hidden = false;
      popup.setAttribute("aria-hidden", "false");
      requestAnimationFrame(function () { popup.classList.add("is-open"); });
      closeBtn.focus();
    }, 500);
  }

  function renderReservationDateNote() {
    var note = document.getElementById("eventDateNote");
    var dateInput = document.getElementById("rf-date");
    if (!note || !dateInput) return; // pas cette page (ex: index.html, admin.html)
    if (!evt || !evt.actif || !evt.date) return;

    var texte = "🎤 Le " + formatDateFR(evt.date) + ", c'est " + (evt.nom || "une soirée spéciale") + " !";

    function update() {
      if (dateInput.value === evt.date) {
        note.textContent = texte;
        note.hidden = false;
      } else {
        note.hidden = true;
      }
    }
    dateInput.addEventListener("input", update);
    dateInput.addEventListener("change", update);
    update(); // au cas où une date serait déjà pré-remplie
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderBandeau();
    renderHeroCarousel();
    renderEventPopup();
    renderReservationDateNote();
  });
})();
