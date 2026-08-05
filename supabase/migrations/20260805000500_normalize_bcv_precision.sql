-- Normaliza la precisión antes de comparar para que los reintentos del feed
-- no creen observaciones nuevas por decimales que la tabla no puede almacenar.

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
  v_usd numeric(18, 6);
  v_eur numeric(18, 6);
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

  v_usd := round(p_usd, 6);
  v_eur := round(p_eur, 6);

  select bcv_usd, bcv_eur
  into v_existing_usd, v_existing_eur
  from public.daily_rates
  where rate_date = p_rate_date;

  if found and v_existing_usd = v_usd and v_existing_eur = v_eur then
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
    v_usd,
    v_eur,
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
    (p_source, 'USD', v_usd, p_published_at),
    (p_source, 'EUR', v_eur, p_published_at);

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
