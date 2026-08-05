-- Distingue la referencia P2P actual del promedio diario usado por gráficas,
-- y evita observaciones BCV duplicadas cuando los reintentos no traen cambios.

alter table public.daily_rates
  add column if not exists p2p_daily_average numeric(18, 6);

alter table public.daily_rates
  drop constraint if exists daily_rates_p2p_daily_average_positive;
alter table public.daily_rates
  add constraint daily_rates_p2p_daily_average_positive
  check (p2p_daily_average is null or p2p_daily_average > 0);

update public.daily_rates
set p2p_daily_average = p2p_average
where p2p_daily_average is null
  and p2p_average is not null;

comment on column public.daily_rates.p2p_average is
  'Referencia P2P más reciente para la fecha.';
comment on column public.daily_rates.p2p_daily_average is
  'Promedio de las observaciones P2P del día, usado por historial y exportación.';

create or replace function public.record_p2p_ingestion(
  p_observed_at timestamptz,
  p_average numeric,
  p_buy_average numeric,
  p_sell_average numeric,
  p_sources jsonb,
  p_observations jsonb default '[]'::jsonb
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate_date date;
  v_records_written integer := 0;
  v_daily_average numeric;
begin
  if p_observed_at is null or p_observed_at > now() + interval '5 minutes' then
    raise exception 'invalid observed_at';
  end if;
  if p_average is null or p_average <= 0 then
    raise exception 'invalid p2p average';
  end if;
  if p_buy_average is not null and p_buy_average <= 0 then
    raise exception 'invalid p2p buy average';
  end if;
  if p_sell_average is not null and p_sell_average <= 0 then
    raise exception 'invalid p2p sell average';
  end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'object' then
    raise exception 'p_sources must be an object';
  end if;
  if p_observations is null or jsonb_typeof(p_observations) <> 'array' then
    raise exception 'p_observations must be an array';
  end if;

  v_rate_date := (p_observed_at at time zone 'America/Caracas')::date;

  insert into private.rate_observations (
    provider,
    currency,
    buy_rate,
    sell_rate,
    observed_at,
    raw_payload
  )
  select
    observation.provider,
    'USDT',
    observation.buy_rate,
    observation.sell_rate,
    p_observed_at,
    observation.raw_payload
  from jsonb_to_recordset(p_observations) as observation(
    provider text,
    buy_rate numeric,
    sell_rate numeric,
    raw_payload jsonb
  )
  where observation.provider is not null
    and btrim(observation.provider) <> ''
    and (observation.buy_rate > 0 or observation.sell_rate > 0);

  get diagnostics v_records_written = row_count;

  select avg(coalesce(buy_rate, sell_rate))
  into v_daily_average
  from private.rate_observations
  where currency = 'USDT'
    and (observed_at at time zone 'America/Caracas')::date = v_rate_date;

  insert into public.daily_rates (
    rate_date,
    p2p_average,
    p2p_daily_average,
    p2p_buy_average,
    p2p_sell_average,
    p2p_sources,
    p2p_observed_at
  )
  values (
    v_rate_date,
    p_average,
    coalesce(v_daily_average, p_average),
    p_buy_average,
    p_sell_average,
    p_sources,
    p_observed_at
  )
  on conflict (rate_date) do update set
    p2p_average = excluded.p2p_average,
    p2p_daily_average = excluded.p2p_daily_average,
    p2p_buy_average = excluded.p2p_buy_average,
    p2p_sell_average = excluded.p2p_sell_average,
    p2p_sources = excluded.p2p_sources,
    p2p_observed_at = excluded.p2p_observed_at;

  insert into private.ingestion_runs (
    job_name,
    status,
    finished_at,
    records_written,
    metadata
  )
  values (
    'ingest-p2p',
    'succeeded',
    now(),
    v_records_written,
    jsonb_build_object(
      'rate_date', v_rate_date,
      'average', p_average,
      'daily_average', coalesce(v_daily_average, p_average)
    )
  );

  return v_rate_date;
end;
$$;

create or replace function public.record_bcv_ingestion(
  p_rate_date date,
  p_usd numeric,
  p_eur numeric,
  p_published_at timestamptz default now(),
  p_source text default 'bcv'
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_usd numeric;
  v_existing_eur numeric;
begin
  if p_rate_date is null
    or p_rate_date < date '2020-01-01'
    or p_rate_date > (now() at time zone 'America/Caracas')::date + 7 then
    raise exception 'invalid BCV rate date';
  end if;
  if p_usd is null or p_usd <= 0 or p_eur is null or p_eur <= 0 then
    raise exception 'invalid BCV rates';
  end if;
  if p_published_at is null or p_published_at > now() + interval '5 minutes' then
    raise exception 'invalid BCV published_at';
  end if;
  if p_source is null or btrim(p_source) = '' then
    raise exception 'invalid BCV source';
  end if;

  select bcv_usd, bcv_eur
  into v_existing_usd, v_existing_eur
  from public.daily_rates
  where rate_date = p_rate_date;

  if found and v_existing_usd = p_usd and v_existing_eur = p_eur then
    insert into private.ingestion_runs (
      job_name,
      status,
      finished_at,
      records_written,
      metadata
    )
    values (
      'ingest-bcv',
      'skipped',
      now(),
      0,
      jsonb_build_object('rate_date', p_rate_date, 'reason', 'unchanged')
    );
    return p_rate_date;
  end if;

  insert into public.daily_rates (
    rate_date,
    bcv_usd,
    bcv_eur,
    bcv_published_at
  )
  values (
    p_rate_date,
    p_usd,
    p_eur,
    p_published_at
  )
  on conflict (rate_date) do update set
    bcv_usd = excluded.bcv_usd,
    bcv_eur = excluded.bcv_eur,
    bcv_published_at = excluded.bcv_published_at;

  insert into private.rate_observations (
    provider,
    currency,
    buy_rate,
    observed_at
  )
  values
    (p_source, 'USD', p_usd, p_published_at),
    (p_source, 'EUR', p_eur, p_published_at);

  insert into private.ingestion_runs (
    job_name,
    status,
    finished_at,
    records_written,
    metadata
  )
  values (
    'ingest-bcv',
    'succeeded',
    now(),
    2,
    jsonb_build_object('rate_date', p_rate_date, 'source', p_source)
  );

  return p_rate_date;
end;
$$;
