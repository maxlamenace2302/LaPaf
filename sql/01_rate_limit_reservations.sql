-- Anti-spam serveur sur le formulaire public de réservation.
-- Appliqué en prod le 2026-08-16 (migration `add_reservation_rate_limit`).
--
-- Le honeypot et la validation côté client ne protègent que le navigateur :
-- un bot peut poster directement sur /rest/v1/reservations avec la clé
-- publishable. Ce garde-fou vit donc dans Postgres, et ne s'applique qu'aux
-- insertions faites par le rôle `anon` — le chef, authentifié, saisit les
-- appels téléphoniques en rafale sans jamais être limité.
create or replace function public.enforce_reservation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_phone_key     text;
  v_recent_phone  int;
  v_recent_email  int;
  v_recent_global int;
begin
  if coalesce(auth.role(), 'anon') <> 'anon' then
    return new;
  end if;

  v_phone_key := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');

  -- 1. Même numéro de téléphone : 3 demandes par heure maximum.
  if length(v_phone_key) >= 6 then
    select count(*) into v_recent_phone
      from public.reservations
     where regexp_replace(phone, '\D', '', 'g') = v_phone_key
       and created_at > now() - interval '1 hour';
    if v_recent_phone >= 3 then
      raise exception 'rate_limit_phone'
        using hint = 'Trop de demandes depuis ce numéro. Merci d''appeler le restaurant.',
              errcode = 'check_violation';
    end if;
  end if;

  -- 2. Même e-mail : 3 demandes par heure maximum.
  if new.email is not null and length(trim(new.email)) > 3 then
    select count(*) into v_recent_email
      from public.reservations
     where lower(email) = lower(trim(new.email))
       and created_at > now() - interval '1 hour';
    if v_recent_email >= 3 then
      raise exception 'rate_limit_email'
        using hint = 'Trop de demandes depuis cette adresse e-mail.',
              errcode = 'check_violation';
    end if;
  end if;

  -- 3. Garde-fou global : 25 demandes publiques en 10 minutes. Un vrai service
  --    tourne à quelques demandes par jour ; au-delà c'est une attaque, pas un
  --    coup de feu.
  select count(*) into v_recent_global
    from public.reservations
   where created_at > now() - interval '10 minutes'
     and handled_by is null;
  if v_recent_global >= 25 then
    raise exception 'rate_limit_global'
      using hint = 'Service momentanément saturé, merci d''appeler le restaurant.',
            errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_reservation_rate_limit() from public, anon, authenticated;

drop trigger if exists reservations_rate_limit on public.reservations;
create trigger reservations_rate_limit
  before insert on public.reservations
  for each row execute function public.enforce_reservation_rate_limit();

create index if not exists reservations_created_at_idx
  on public.reservations (created_at desc);
