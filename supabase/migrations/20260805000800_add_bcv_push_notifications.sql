-- Push remoto al publicarse una tasa BCV nueva y bloque temprano de reintentos.

create table if not exists public.device_push_tokens (
  token text primary key,
  platform text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint device_push_tokens_token_valid check (
    token ~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$'
  ),
  constraint device_push_tokens_platform_valid check (
    platform is null or platform in ('android', 'ios')
  )
);

alter table public.device_push_tokens enable row level security;

revoke all on table public.device_push_tokens from anon, authenticated;
grant insert, update on table public.device_push_tokens to anon, authenticated;
grant select, insert, update, delete on table public.device_push_tokens to service_role;

drop policy if exists "push token insert" on public.device_push_tokens;
create policy "push token insert"
  on public.device_push_tokens
  for insert
  to anon, authenticated
  with check (
    token ~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$'
    and (platform is null or platform in ('android', 'ios'))
  );

drop policy if exists "push token update" on public.device_push_tokens;
create policy "push token update"
  on public.device_push_tokens
  for update
  to anon, authenticated
  using (true)
  with check (
    token ~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$'
    and (platform is null or platform in ('android', 'ios'))
  );

-- No se concede SELECT a clientes: los tokens de otros dispositivos no se listan.

drop trigger if exists set_device_push_tokens_updated_at on public.device_push_tokens;
create trigger set_device_push_tokens_updated_at
before update on public.device_push_tokens
for each row execute function private.set_updated_at();

create or replace function private.notify_new_bcv_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
  v_usd_text text;
begin
  if tg_op = 'UPDATE' and old.bcv_usd is not distinct from new.bcv_usd then
    return new;
  end if;

  -- Evita pushes por correcciones/importaciones de fechas históricas.
  if new.bcv_usd is null
    or new.rate_date < (now() at time zone 'America/Caracas')::date then
    return new;
  end if;

  v_usd_text := replace(
    to_char(new.bcv_usd, 'FM999999999990.00'),
    '.',
    ','
  );

  -- Expo admite hasta 100 mensajes por solicitud.
  for v_messages in
    select jsonb_agg(message order by token)
    from (
      select
        token,
        ((row_number() over (order by token) - 1) / 100)::integer as batch_number,
        jsonb_build_object(
          'to', token,
          'title', 'Nueva tasa BCV disponible 💵',
          'body', 'El BCV publicó una nueva tasa: Bs. ' || v_usd_text ||
            ' por USD. Ábrela en Kuanto.',
          'sound', 'default',
          'priority', 'high',
          'channelId', 'bcv-alerts',
          'data', jsonb_build_object('type', 'bcv', 'date', new.rate_date)
        ) as message
      from public.device_push_tokens
      where enabled = true
    ) as queued_messages
    group by batch_number
    order by batch_number
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      timeout_milliseconds := 15000
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.notify_new_bcv_rate()
  from public, anon, authenticated;

drop trigger if exists notify_new_bcv_rate_on_insert on public.daily_rates;
create trigger notify_new_bcv_rate_on_insert
after insert
on public.daily_rates
for each row
when (new.bcv_usd is not null)
execute function private.notify_new_bcv_rate();

drop trigger if exists notify_new_bcv_rate_on_update on public.daily_rates;
create trigger notify_new_bcv_rate_on_update
after update of bcv_usd, bcv_published_at
on public.daily_rates
for each row
when (old.bcv_usd is distinct from new.bcv_usd)
execute function private.notify_new_bcv_rate();

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'kuanto-mobile-bcv-early-retries'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

-- 14:05-16:35 VET equivale a 18:05-20:35 UTC del mismo día.
select cron.schedule(
  'kuanto-mobile-bcv-early-retries',
  '5,35 18-20 * * 1-5',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mobile_project_url'
      ) || '/functions/v1/ingest-bcv',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'mobile_cron_secret'
        )
      ),
      body := '{"source":"cron-early"}'::jsonb,
      timeout_milliseconds := 25000
    );
  $job$
);
