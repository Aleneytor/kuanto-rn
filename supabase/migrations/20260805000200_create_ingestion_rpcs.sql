-- Entradas privilegiadas para las Edge Functions de ingesta.
-- Solo service_role puede ejecutarlas; anon/authenticated no pueden escribir.

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

  insert into public.daily_rates (
    rate_date,
    p2p_average,
    p2p_buy_average,
    p2p_sell_average,
    p2p_sources,
    p2p_observed_at
  )
  values (
    v_rate_date,
    p_average,
    p_buy_average,
    p_sell_average,
    p_sources,
    p_observed_at
  )
  on conflict (rate_date) do update set
    p2p_average = excluded.p2p_average,
    p2p_buy_average = excluded.p2p_buy_average,
    p2p_sell_average = excluded.p2p_sell_average,
    p2p_sources = excluded.p2p_sources,
    p2p_observed_at = excluded.p2p_observed_at;

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
    jsonb_build_object('rate_date', v_rate_date, 'average', p_average)
  );

  return v_rate_date;
end;
$$;

revoke all on function public.record_p2p_ingestion(
  timestamptz,
  numeric,
  numeric,
  numeric,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.record_p2p_ingestion(
  timestamptz,
  numeric,
  numeric,
  numeric,
  jsonb,
  jsonb
) to service_role;

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

revoke all on function public.record_bcv_ingestion(
  date,
  numeric,
  numeric,
  timestamptz,
  text
) from public, anon, authenticated;
grant execute on function public.record_bcv_ingestion(
  date,
  numeric,
  numeric,
  timestamptz,
  text
) to service_role;
