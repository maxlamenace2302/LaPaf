# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Marketing site **+ chef-facing reservation dashboard** for **La Petite Auberge de Flo**, a traditional French restaurant in Saint-Bonnet-les-Oules. Five pages, four languages (FR/EN/DE/IT), no build system, no package manager. Backend is Supabase (Postgres + Auth + Realtime).

- `index.html` — homepage (hero, history, specialités, soirées, galerie, contact)
- `carte.html` — full menu page (`carte.css`)
- `reservation.html` — public booking form (`reservation.css`) — INSERTs into Supabase
- `admin.html` — private chef dashboard (`admin.css`) — Auth-gated SELECT/UPDATE
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

All colours, fonts, container width, and gutter live as CSS custom properties in `:root` at the top of `styles.css`. The palette is derived from the logo — **coral `#E63946`**, **aubergine `#3A1A2A`**, **cream `#FBF6EE`**. Type stack: Cormorant Garamond (serif headings), Caveat / Caveat Brush (script accents), Inter (sans body). Change the token, not the call site.

`carte.css` and `reservation.css` are page-scoped supplements that assume the tokens from `styles.css` are already loaded.

## Editing conventions worth knowing

- HTML uses real French typography in copy (`'`, `&nbsp;`, `&amp;`) — keep it, it's not a mistake.
- The `.eyebrow` / `.eyebrow--light` pattern is the small uppercase label above every section title; reuse it instead of inventing a new class.
- The nav on subpages (`carte.html`, `reservation.html`) uses the `cartepage__nav` / `reservepage__nav` variant with a back link — don't paste the homepage `.nav` there.
