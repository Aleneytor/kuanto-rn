import { callAdminRpc } from '../_shared/adminRpc.ts';
import { errorResponse, HttpError, jsonResponse, requireCronAuth } from '../_shared/cronAuth.ts';

interface Pair {
  buy: number;
  sell: number;
}

interface ProviderResult {
  provider: 'binance' | 'bybit';
  pair: Pair;
  samples: number;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    requireCronAuth(request);

    const providers = await Promise.all([
      fetchBinance(),
      fetchBybit(),
    ]);

    const buyAverage = average(providers.map(({ pair }) => pair.buy));
    const sellAverage = average(providers.map(({ pair }) => pair.sell));
    const observedAt = new Date().toISOString();
    const sources = Object.fromEntries(providers.map(({ provider, pair }) => [provider, pair]));

    const rateDate = await callAdminRpc<string>('record_p2p_ingestion', {
      p_observed_at: observedAt,
      p_average: buyAverage,
      p_buy_average: buyAverage,
      p_sell_average: sellAverage,
      p_sources: sources,
      p_observations: providers.map(({ provider, pair, samples }) => ({
        provider,
        buy_rate: pair.buy,
        sell_rate: pair.sell,
        raw_payload: { samples },
      })),
    });

    return jsonResponse({
      success: true,
      rateDate,
      average: buyAverage,
      providers: providers.map(({ provider }) => provider),
      observedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

async function fetchBinance(): Promise<ProviderResult> {
  const [buy, sell] = await Promise.all([
    fetchBinanceSide('BUY'),
    fetchBinanceSide('SELL'),
  ]);
  return {
    provider: 'binance',
    pair: { buy: buy.value, sell: sell.value },
    samples: buy.samples + sell.samples,
  };
}

async function fetchBinanceSide(tradeType: 'BUY' | 'SELL') {
  const response = await fetch(
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; KuantoMobile/1.0)',
        Origin: 'https://p2p.binance.com',
        Referer: 'https://p2p.binance.com/',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        merchantCheck: false,
        page: 1,
        payTypes: [],
        publisherType: null,
        rows: 10,
        tradeType,
      }),
    },
  );
  if (!response.ok) throw new Error(`Binance ${tradeType}: HTTP ${response.status}`);
  const body = await response.json();
  const prices = (body?.data ?? [])
    .map((item: { adv?: { price?: string } }) => Number(item.adv?.price))
    .filter(isPositive);
  const filtered = filterOutliers(prices);
  return { value: average(filtered), samples: filtered.length };
}

async function fetchBybit(): Promise<ProviderResult> {
  const [buy, sell] = await Promise.all([
    fetchBybitSide('1'),
    fetchBybitSide('0'),
  ]);
  return {
    provider: 'bybit',
    pair: { buy: buy.value, sell: sell.value },
    samples: buy.samples + sell.samples,
  };
}

async function fetchBybitSide(side: '0' | '1') {
  const response = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
    method: 'POST',
    signal: AbortSignal.timeout(12_000),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; KuantoMobile/1.0)',
      Origin: 'https://www.bybit.com',
      Referer: 'https://www.bybit.com/fiat/trade/otc/',
    },
    body: JSON.stringify({
      tokenId: 'USDT',
      currencyId: 'VES',
      side,
      size: '10',
      page: '1',
      amount: '',
      authMaker: false,
      canTrade: false,
    }),
  });
  if (!response.ok) throw new Error(`Bybit side ${side}: HTTP ${response.status}`);
  const body = await response.json();
  const prices = (body?.result?.items ?? [])
    .map((item: { price?: string }) => Number(item.price))
    .filter(isPositive);
  const filtered = filterOutliers(prices);
  return { value: average(filtered), samples: filtered.length };
}

function filterOutliers(values: number[]): number[] {
  if (values.length === 0) throw new Error('Provider returned no positive prices.');
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const filtered = sorted.filter((value) => Math.abs(value - median) <= median * 0.1);
  if (filtered.length === 0) throw new Error('All provider prices were outliers.');
  return filtered;
}

function average(values: number[]): number {
  const valid = values.filter(isPositive);
  if (valid.length === 0) throw new Error('Cannot average an empty set of rates.');
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
