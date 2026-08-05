-- Kuanto Mobile: esquema inicial reproducible.
-- La app solo lee public.daily_rates. Las tablas de ingesta permanecen fuera
-- del esquema publico y solo son accesibles por procesos backend autorizados.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists public.daily_rates (
  rate_date date primary key,
  bcv_usd numeric(18, 6),
  bcv_eur numeric(18, 6),
  p2p_average numeric(18, 6),
  p2p_buy_average numeric(18, 6),
  p2p_sell_average numeric(18, 6),
  p2p_sources jsonb not null default '{}'::jsonb,
  bcv_published_at timestamptz,
  p2p_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_rates_bcv_usd_positive check (bcv_usd is null or bcv_usd > 0),
  constraint daily_rates_bcv_eur_positive check (bcv_eur is null or bcv_eur > 0),
  constraint daily_rates_p2p_average_positive
    check (p2p_average is null or p2p_average > 0),
  constraint daily_rates_p2p_buy_positive
    check (p2p_buy_average is null or p2p_buy_average > 0),
  constraint daily_rates_p2p_sell_positive
    check (p2p_sell_average is null or p2p_sell_average > 0),
  constraint daily_rates_p2p_sources_object
    check (jsonb_typeof(p2p_sources) = 'object')
);

comment on table public.daily_rates is
  'Contrato de solo lectura para Kuanto Mobile: una fila normalizada por fecha de Venezuela.';
comment on column public.daily_rates.p2p_sources is
  'Desglose opcional por proveedor: {"binance":{"buy":0,"sell":0}, ...}.';

alter table public.daily_rates enable row level security;

revoke all on table public.daily_rates from anon, authenticated;
grant select on table public.daily_rates to anon, authenticated;
grant select, insert, update, delete on table public.daily_rates to service_role;

drop policy if exists "mobile rates are publicly readable" on public.daily_rates;
create policy "mobile rates are publicly readable"
  on public.daily_rates
  for select
  to anon, authenticated
  using (true);

create index if not exists daily_rates_p2p_observed_at_idx
  on public.daily_rates (p2p_observed_at desc)
  where p2p_average is not null;

create table if not exists private.rate_observations (
  id bigint generated always as identity primary key,
  provider text not null,
  currency text not null,
  buy_rate numeric(18, 6),
  sell_rate numeric(18, 6),
  observed_at timestamptz not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),

  constraint rate_observations_provider_not_blank check (btrim(provider) <> ''),
  constraint rate_observations_currency_not_blank check (btrim(currency) <> ''),
  constraint rate_observations_buy_positive check (buy_rate is null or buy_rate > 0),
  constraint rate_observations_sell_positive check (sell_rate is null or sell_rate > 0),
  constraint rate_observations_has_value check (buy_rate is not null or sell_rate is not null)
);

create index if not exists rate_observations_lookup_idx
  on private.rate_observations (currency, provider, observed_at desc);

create table if not exists private.ingestion_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_written integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,

  constraint ingestion_runs_job_name_not_blank check (btrim(job_name) <> ''),
  constraint ingestion_runs_status_valid
    check (status in ('running', 'succeeded', 'failed', 'skipped')),
  constraint ingestion_runs_records_written_nonnegative check (records_written >= 0),
  constraint ingestion_runs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ingestion_runs_job_started_idx
  on private.ingestion_runs (job_name, started_at desc);

revoke all on table private.rate_observations from public, anon, authenticated;
revoke all on table private.ingestion_runs from public, anon, authenticated;
grant select, insert, update, delete on table private.rate_observations to service_role;
grant select, insert, update, delete on table private.ingestion_runs to service_role;
grant usage, select on all sequences in schema private to service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;

drop trigger if exists set_daily_rates_updated_at on public.daily_rates;
create trigger set_daily_rates_updated_at
before update on public.daily_rates
for each row execute function private.set_updated_at();
