# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Marketing site **+ chef-facing reservation dashboard** for **La Petite Auberge de Flo**, a traditional French restaurant in Saint-Bonnet-les-Oules. Five pages, four languages (FR/EN/DE/IT), no build system, no package manager. Backend is Supabase (Postgres + Auth + Realtime).

- `index.html` — homepage (hero, history, specialités, soirées, galerie, contact)
- `carte.html` — full menu page (`carte.css`)
- `reservation.html` — public booking form (`reservation.css`) — INSERTs into Supabase
- `admin.html` — private chef dashboard (`admin.css` + `cahier.css`) — Auth-gated SELECT/UPDATE
- `supabase.js` — shared ES module: Supabase client + all DB/auth helpers
- `styles.css` — global styles + design tokens, shared by all pages
- `i18n.js` — single translation dictionary for all four languages
- `assets/` — JPEGs of the restaurant, dishes, logo

## Running locally

No build step. Open `index.html` directly, or serve the directory for cleaner relative-path / `fetch()` behavior:

```bash
python3 -m http.server 8000
# then http://localhost:8000/
```

## Backend (Supabase)

Project ID `pmuczxviazbvfmvfqzlk` · region `eu-central-1` · URL `https://pmuczxviazbvfmvfqzlk.supabase.co`. The publishable key (`sb_publishable_…`) is in [supabase.js](supabase.js) — safe to ship because RLS does the real protection.

**Table `public.reservations`** holds every booking. The state machine on `status` is `en_attente → confirmee | refusee | annulee`. A `BEFORE UPDATE` trigger (`public.set_handled_at`) populates `handled_at` + `handled_by` whenever the chef leaves `en_attente`, and clears them on reopen. Realtime is enabled (`supabase_realtime` publication) so `admin.html`'s subscription gets pushed updates without polling.

**Cahier columns (added 2026-08-17).** `table_no` (free text, ≤ 20 chars — "12", "3+4", "terrasse"), `attendance` (`arrive` | `absent` | null) and `attendance_at`. **`attendance` is deliberately separate from `status`** — do not merge them: adding `'arrive'` to the `status` enum breaks the `set_handled_at` trigger and makes "confirmed but never showed up" impossible to express, which is the exact case no-show is meant to measure.

⚠️ **Privileges on `reservations` are granted column by column** (see `information_schema.column_privileges`). Adding a column without a matching `GRANT` in the same migration makes every `select('*')` fail with *permission denied* on the whole table — the dashboard goes dark. Always grant SELECT/INSERT/UPDATE to `authenticated` alongside the `ALTER TABLE`. Never to `anon`.

**`service_overrides.notes` holds the chef's day memo** (dish of the day, expected group, birthday cake) and therefore contains customer names. `anon` had a table-level `SELECT` on that table; it was replaced by a column-level grant on the other 8 columns so the memo stays private. Note that `REVOKE SELECT (notes)` against a *table-level* grant is accepted by Postgres and silently does nothing — the grant must be dropped and re-issued per column. `get_service_state` is `SECURITY DEFINER` and is unaffected; `get_previsions` is `SECURITY INVOKER` and still reads `manually_closed`, which is why the other columns were kept.

**RLS — read this before touching policies.**
- Role `anon` (public form, no auth) is allowed `INSERT` *only*, and only on the user-supplied columns (`date, service, guests, name, phone, email, notes, lang`). It has no `SELECT` — so visitors cannot see other people's reservations, and `.insert(row).select()` from anon will fail with *permission denied*. The client in `supabase.js` deliberately omits `.select()` for the public insert. Don't add it back.
- Role `authenticated` (the chef) has `ALL` (SELECT, INSERT, UPDATE, DELETE) on every column. Anything in `admin.html` runs in this role after `signIn`.
- The trigger function is `SECURITY INVOKER` and has `EXECUTE` revoked from `public, anon, authenticated` — keep it that way, or the security advisor will warn about exposed RPC functions.

**Auth.** Single chef account, email + password. Created via SQL admin (`auth.users` + `auth.identities` row). Sessions persist (`autoRefreshToken: true`) so the chef stays logged in across PWA opens. There's no signup flow — to add another staff member, either insert via SQL or use the Supabase dashboard.

Restaurant phone shown as fallback: **09 55 82 02 14** (`tel:0955820214`). Update both forms if it changes.

## i18n contract

Translations live in `window.I18N` in `i18n.js`, keyed by language (`fr`, `en`, `de`, `it`) then by string key. The runtime that swaps text is also defined in `i18n.js` and is loaded with `<script src="i18n.js" defer>` on every page.

- Text nodes: `<element data-i18n="some.key">fallback</element>`
- Attributes: `data-i18n-attr="placeholder:reserve.field.notes.placeholder"` (comma-separate multiple)
- Document title: `<html data-i18n-title="cartepage.title">` on the `<html>` tag
- Language switcher: any `<button data-lang="fr|en|de|it">` inside a `.lang-switch` group; clicking sets `<html lang>` and re-renders.

**When adding a new string, add the key to all four languages.** Missing keys fall back to French, then to the raw key — easy to ship a half-translated UI without noticing. The reservation submit handler also reads keys (`reserve.submitting`, `reserve.submit`) via a small `t()` helper that hits the same dictionary.

## Design tokens

All colours, fonts, container width, and gutter live as CSS custom properties in `:root` at the top of `styles.css`. The palette is derived from the logo — **coral `#E63946`**, **aubergine `#3A1A2A`**, **cream `#FBF6EE`**. Type stack on the public pages: Cormorant Garamond (serif headings), Caveat / Caveat Brush (script accents), Inter (sans body). Change the token, not the call site.

`carte.css` and `reservation.css` are page-scoped supplements that assume the tokens from `styles.css` are already loaded.

**The dashboard runs the restaurant's real brand type instead: Boogaloo (headings) + Poppins (body), with Caveat for the handwritten comments in the cahier.** Those are redefined on `body.adminpage` inside `cahier.css` — **never in `styles.css`**, which is shared by all five pages and would push the change onto the public site.

Coral `#E63946` on cream measures ~4.0:1, below AA. Red **text** must use `--coral-deep` `#A12230`; coral stays for fills and icons.

⚠️ `sw.js` is **cache-first on `admin.html`**. Ship any dashboard change with a bumped `CACHE_VERSION`, or the chef opens the previous version from cache and only sees the new one on the following launch.

## Editing conventions worth knowing

- HTML uses real French typography in copy (`'`, `&nbsp;`, `&amp;`) — keep it, it's not a mistake.
- The `.eyebrow` / `.eyebrow--light` pattern is the small uppercase label above every section title; reuse it instead of inventing a new class.
- The nav on subpages (`carte.html`, `reservation.html`) uses the `cartepage__nav` / `reservepage__nav` variant with a back link — don't paste the homepage `.nav` there.
