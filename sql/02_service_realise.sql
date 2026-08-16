-- Couverts réellement servis, saisis par le chef en fin de service.
-- Appliqué en prod le 2026-08-16 (migration `add_service_realise`).
--
-- Table volontairement vide à ce jour : Max a choisi de ne pas imposer de saisie
-- quotidienne. Elle attend. La vue et la fonction de prévision gèrent le cas.
--
-- Pourquoi une table dédiée : les réservations en ligne ne représentent qu'une
-- fraction de l'activité (2 à 3 couverts par service en moyenne, alors que la
-- salle en fait bien plus). Sans le réalisé, une prévision ne prédit que la
-- demande web. `service_overrides` reste ce qu'elle est — les réglages du jour,
-- lus par get_service_state — et n'est pas alourdie.
create table if not exists public.service_realise (
  date            date        not null,
  service         text        not null check (service in ('midi', 'soir')),
  couverts_servis integer     not null check (couverts_servis >= 0 and couverts_servis <= 500),
  note            text,
  saisi_par       uuid        references auth.users(id),
  saisi_le        timestamptz not null default now(),
  primary key (date, service)
);

alter table public.service_realise enable row level security;

drop policy if exists "chef gere le realise" on public.service_realise;
create policy "chef gere le realise"
  on public.service_realise
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists service_realise_date_idx on public.service_realise (date desc);
