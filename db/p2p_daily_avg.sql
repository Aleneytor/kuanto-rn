-- Vista: promedio diario de USDT (P2P) en hora de Venezuela (America/Caracas, UTC-4).
--
-- Por qué: el Historial necesita ~1 valor por día, pero la tabla p2p_rate_history
-- guarda muchos ticks por día. Sin esta vista, la app baja miles de filas y las
-- promedia en el cliente (lento en la 1ª carga). Con la vista, Supabase devuelve
-- ~1 fila/día ya agregada.
--
-- Cómo usar: pegar y ejecutar UNA vez en el SQL Editor de Supabase
-- (Dashboard → SQL Editor → New query → Run). Es idempotente (create or replace).
--
-- security_invoker = on: la vista respeta la RLS de la tabla base (la app ya lee
-- p2p_rate_history con la anon key, así que el anon puede leer estos agregados).

create or replace view public.p2p_daily_avg
with (security_invoker = on) as
select
  (created_at at time zone 'America/Caracas')::date as day,
  avg(price) as usdt,
  count(*)   as samples
from public.p2p_rate_history
where price > 0
group by 1;

grant select on public.p2p_daily_avg to anon, authenticated;
