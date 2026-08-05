-- Desde esta versión, el promedio P2P de Kuanto usa exclusivamente Binance y Bybit.

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
  if p_buy_average is null or p_buy_average <= 0
    or p_sell_average is null or p_sell_average <= 0 then
    raise exception 'both P2P averages are required';
  end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'object'
    or not (p_sources ? 'binance') or not (p_sources ? 'bybit') then
    raise exception 'Binance and Bybit sources are required';
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
  where observation.provider in ('binance', 'bybit')
    and (observation.buy_rate > 0 or observation.sell_rate > 0);

  get diagnostics v_records_written = row_count;
  if v_records_written <> 2 then
    raise exception 'exactly two P2P provider observations are required';
  end if;

  select avg(coalesce(buy_rate, sell_rate))
  into v_daily_average
  from private.rate_observations
  where currency = 'USDT'
    and provider in ('binance', 'bybit')
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
    v_daily_average,
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
      'daily_average', v_daily_average,
      'providers', jsonb_build_array('binance', 'bybit')
    )
  );

  return v_rate_date;
end;
$$;
