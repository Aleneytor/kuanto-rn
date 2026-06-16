-- Push "nueva tasa BCV": notifica a los dispositivos justo al insertarse una
-- fila nueva en bcv_rates_history.
--
-- Por qué: el scraper del BCV corre desde las 5:00pm VET cada 30 min hasta que
-- aparece la tasa. Cuando inserta la fila, este trigger llama a la API de Expo
-- Push para avisar a todos los dispositivos registrados al instante.
--
-- Cómo usar: pegar y ejecutar UNA vez en el SQL Editor de Supabase
-- (Dashboard → SQL Editor → New query → Run). Es idempotente.
--
-- Requisitos: el push remoto NO funciona en Expo Go; los dispositivos deben
-- correr un development/production build con projectId de EAS para registrar
-- su Expo push token (tabla device_push_tokens, que llena la app en Ajustes).

-- 1) Tabla de tokens -----------------------------------------------------------
create table if not exists public.device_push_tokens (
  token      text primary key,
  platform   text,
  enabled    boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: el rol anon (la app) puede registrar/actualizar SU token, pero NADIE
-- puede listar la tabla (sin policy de SELECT). El trigger lee los tokens vía
-- SECURITY DEFINER, así que no necesita SELECT para anon.
alter table public.device_push_tokens enable row level security;

grant insert, update on public.device_push_tokens to anon, authenticated;

drop policy if exists "push token insert" on public.device_push_tokens;
create policy "push token insert" on public.device_push_tokens
  for insert to anon, authenticated with check (true);

drop policy if exists "push token update" on public.device_push_tokens;
create policy "push token update" on public.device_push_tokens
  for update to anon, authenticated using (true) with check (true);

-- 2) Extensión para hacer HTTP desde Postgres ----------------------------------
create extension if not exists pg_net;

-- 3) Función que envía el push a la API de Expo --------------------------------
create or replace function public.notify_new_bcv_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
  usd_txt  text;
begin
  -- "36,50" (formato venezolano: coma decimal).
  usd_txt := replace(to_char(NEW.usd::numeric, 'FM999990.00'), '.', ',');

  -- Un mensaje por token activo (Expo acepta un array de mensajes).
  select jsonb_agg(
           jsonb_build_object(
             'to',        t.token,
             'title',     'Nueva tasa BCV disponible 💵',
             'body',      'El BCV publicó una nueva tasa: Bs. ' || usd_txt || ' por USD. Ábrela en Kuanto.',
             'sound',     'default',
             'priority',  'high',
             'channelId', 'bcv-alerts',
             'data',      jsonb_build_object('type', 'bcv', 'date', NEW.date)
           )
         )
  into   messages
  from   public.device_push_tokens t
  where  t.enabled = true;

  -- Sin dispositivos registrados: nada que enviar.
  if messages is null then
    return NEW;
  end if;

  -- Si activas "Enhanced Push Security" en Expo, agrega el header:
  --   'Authorization', 'Bearer <tu-expo-access-token>'
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := messages,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Accept',       'application/json'
               )
  );

  return NEW;
end;
$$;

-- 4) Trigger -------------------------------------------------------------------
-- Solo notifica para tasas de hoy o futuras (evita avisar en re-importaciones
-- históricas). Si tu scraper hace UPSERT (UPDATE) en vez de INSERT, cambia a:
--   after insert or update of usd ... when (OLD.usd is distinct from NEW.usd and NEW.date::date >= ...)
drop trigger if exists trg_notify_new_bcv_rate on public.bcv_rates_history;
create trigger trg_notify_new_bcv_rate
  after insert on public.bcv_rates_history
  for each row
  when (NEW.date::date >= (now() at time zone 'America/Caracas')::date)
  execute function public.notify_new_bcv_rate();

-- Prueba manual (opcional): inserta una fila futura y verifica que llega el push.
--   insert into public.bcv_rates_history (date, usd, eur)
--   values ((now() at time zone 'America/Caracas')::date + 1, 99.99, 105.55);
