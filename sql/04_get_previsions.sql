-- Prévision d'affluence par date + service.
-- Appliqué en prod le 2026-08-16 (migration `add_forecast_function`).
--
-- Méthode : moyenne pondérée des dernières occurrences du même jour de semaine
-- et du même service (les plus récentes pèsent plus, facteur 0.85 par rang).
-- Volontairement simple et lisible : avec quelques mois d'historique et un
-- restaurant de village, un modèle plus sophistiqué serait du bruit habillé en
-- précision. La colonne `fiabilite` dit ce que vaut chaque ligne.
--
-- SECURITY INVOKER : la fonction lit v_service_activite, elle-même en
-- security_invoker — seul le chef authentifié obtient des résultats, le rôle
-- anon se heurte à la RLS de `reservations`. Aucun chiffre de salle ne fuit.
create or replace function public.get_previsions(p_from date default current_date,
                                                 p_to   date default (current_date + 14))
returns table (
  date               date,
  service            text,
  jour_semaine       int,
  ferme              boolean,
  prevision_couverts int,
  mini_observe       int,
  maxi_observe       int,
  deja_reserve       int,
  observations       int,
  dont_mesurees      int,
  fiabilite          text
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with futur as (
    select a.date, a.service, a.jour_semaine, a.ferme,
           a.couverts_confirmes + a.couverts_hors_appli as deja_reserve
      from public.v_service_activite a
     where a.date between p_from and p_to
  ),
  passe as (
    select a.jour_semaine, a.service, a.date, a.couverts_reference, a.source,
           row_number() over (partition by a.jour_semaine, a.service
                              order by a.date desc) as rang
      from public.v_service_activite a
     where a.date < current_date
       and not a.ferme
  ),
  base as (
    select p.jour_semaine, p.service,
           sum(p.couverts_reference * power(0.85, p.rang - 1))
             / nullif(sum(power(0.85, p.rang - 1)), 0) as moyenne_ponderee,
           min(p.couverts_reference)                    as mini,
           max(p.couverts_reference)                    as maxi,
           count(*)                                     as n,
           count(*) filter (where p.source = 'realise') as n_mesurees
      from passe p
     where p.rang <= 8
     group by p.jour_semaine, p.service
  )
  select f.date,
         f.service,
         f.jour_semaine,
         f.ferme,
         case when f.ferme then 0
              else greatest(round(coalesce(b.moyenne_ponderee, 0))::int, f.deja_reserve) end,
         coalesce(b.mini, 0)::int,
         coalesce(b.maxi, 0)::int,
         f.deja_reserve::int,
         coalesce(b.n, 0)::int,
         coalesce(b.n_mesurees, 0)::int,
         case
           when f.ferme                       then 'ferme'
           when coalesce(b.n, 0) < 3          then 'insuffisante'
           when coalesce(b.n_mesurees, 0) = 0 then 'reservations_seules'
           when b.n_mesurees < b.n / 2.0      then 'partielle'
           else 'bonne'
         end
    from futur f
    left join base b
           on b.jour_semaine = f.jour_semaine and b.service = f.service
   order by f.date, f.service;
$$;

comment on function public.get_previsions(date, date) is
  'Prévision de couverts par date+service, à partir des 8 dernières occurrences '
  'du même jour de semaine. fiabilite = ferme | insuffisante | reservations_seules '
  '| partielle | bonne. "reservations_seules" signifie que le chef n''a pas encore '
  'saisi de couverts réalisés : le chiffre ne reflète alors que la demande web.';

revoke execute on function public.get_previsions(date, date) from anon, public;
grant execute on function public.get_previsions(date, date) to authenticated;
