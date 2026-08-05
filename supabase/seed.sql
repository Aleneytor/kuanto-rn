-- Datos locales opcionales para verificar la interfaz sin depender de Internet.
-- Este archivo no debe aplicarse al proyecto de produccion.

insert into public.daily_rates (
  rate_date,
  bcv_usd,
  bcv_eur,
  p2p_average,
  p2p_daily_average,
  p2p_buy_average,
  p2p_sell_average,
  p2p_sources,
  bcv_published_at,
  p2p_observed_at
)
values
  (
    current_date - 1,
    100.000000,
    108.000000,
    125.000000,
    125.000000,
    124.000000,
    126.000000,
    '{"binance":{"buy":124,"sell":126},"bybit":{"buy":124.5,"sell":125.5}}',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    current_date,
    101.000000,
    109.000000,
    127.000000,
    127.000000,
    126.000000,
    128.000000,
    '{"binance":{"buy":126,"sell":128},"bybit":{"buy":126.5,"sell":127.5}}',
    now(),
    now()
  )
on conflict (rate_date) do update set
  bcv_usd = excluded.bcv_usd,
  bcv_eur = excluded.bcv_eur,
  p2p_average = excluded.p2p_average,
  p2p_daily_average = excluded.p2p_daily_average,
  p2p_buy_average = excluded.p2p_buy_average,
  p2p_sell_average = excluded.p2p_sell_average,
  p2p_sources = excluded.p2p_sources,
  bcv_published_at = excluded.bcv_published_at,
  p2p_observed_at = excluded.p2p_observed_at;
