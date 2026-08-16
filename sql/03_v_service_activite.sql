-- Historique d'activité, une ligne par (date, service).
-- Appliqué en prod le 2026-08-16 (migrations `add_activity_history_view`
-- puis `update_activity_view_with_realise_v2`).
--
-- Socle des prévisions : répondre à « combien de couverts un vendredi soir ? »
-- sans relire les réservations une par une.
--
-- `couverts_reference` = ce sur quoi on raisonne : le réalisé s'il est saisi,
-- sinon le réservé (confirmé + hors appli). La colonne `source` dit laquelle,
-- pour ne jamais confondre une mesure et une estimation.
drop view if exists public.v_service_activite;

create view public.v_service_activite
with (security_invoker = true)
as
with jours as (
  select d::date as date, s.service
    from generate_series(
           (select min(date) from public.reservations),
           greatest(current_date + 60, (select max(date) from public.reservations)),
           interval '1 day') d
   cross join (values ('midi'), ('soir')) as s(service)
),
etat as (
  select j.date, j.service,
         extract(dow from j.date)::int as jour_semaine,
         to_char(j.date, 'YYYY-MM')    as mois,
         (exists (select 1 from public.restaurant_closures c
                   where c.kind = 'weekly'
                     and c.weekday = extract(dow from j.date)
                     and (c.service is null or c.service = j.service))
          or exists (select 1 from public.restaurant_closures c
                      where c.kind = 'range'
                        and j.date between c.start_date and c.end_date
                        and (c.service is null or c.service = j.service))
          or coalesce((select o.manually_closed from public.service_overrides o
                        where o.date = j.date and o.service = j.service), false)
         ) as ferme
    from jours j
)
select e.date,
       e.service,
       e.jour_semaine,
       e.mois,
       e.ferme,
       coalesce(sum(r.guests) filter (where r.status = 'confirmee'), 0)::int  as couverts_confirmes,
       coalesce(sum(r.guests) filter (where r.status = 'en_attente'), 0)::int as couverts_en_attente,
       coalesce(sum(r.guests) filter (where r.status = 'refusee'), 0)::int    as couverts_refuses,
       coalesce(sum(r.guests) filter (where r.status = 'annulee'), 0)::int    as couverts_annules,
       count(r.id) filter (where r.status = 'confirmee')::int                 as nb_reservations,
       count(r.id) filter (where r.status = 'refusee')::int                   as nb_refus,
       coalesce(o.offline_couverts, 0)::int                                   as couverts_hors_appli,
       (coalesce(sum(r.guests) filter (where r.status = 'confirmee'), 0)
        + coalesce(o.offline_couverts, 0))::int                               as couverts_reserves,
       re.couverts_servis                                                     as couverts_realises,
       coalesce(re.couverts_servis,
                coalesce(sum(r.guests) filter (where r.status = 'confirmee'), 0)
                + coalesce(o.offline_couverts, 0))::int                       as couverts_reference,
       case when re.couverts_servis is not null then 'realise' else 'reserve' end as source,
       o.max_couverts
  from etat e
  left join public.reservations r
         on r.date = e.date and r.service = e.service
  left join public.service_overrides o
         on o.date = e.date and o.service = e.service
  left join public.service_realise re
         on re.date = e.date and re.service = e.service
 group by e.date, e.service, e.jour_semaine, e.mois, e.ferme,
          o.offline_couverts, o.max_couverts, re.couverts_servis;

comment on view public.v_service_activite is
  'Historique par date+service. couverts_reference = réalisé si saisi, sinon réservé ; '
  'la colonne source distingue les deux. Socle des prévisions. security_invoker : '
  'réservé au chef authentifié.';

revoke all on public.v_service_activite from anon;
grant select on public.v_service_activite to authenticated;
