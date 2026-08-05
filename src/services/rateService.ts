import { isMobileBackendConfigured, supabase } from './supabaseClient';

/** Contrato de datos de Kuanto Mobile sobre public.daily_rates. */

export interface HistoryPoint {
  date: string;
  usd: number;
  eur: number;
}

export interface NextRates {
  usd: number;
  eur: number;
  date: string;
  rawDate: string;
}

export interface P2PPair {
  buy: number;
  sell: number;
}

export interface P2PRates {
  binance: P2PPair;
  bybit: P2PPair;
}

export interface Rates {
  bcv: number;
  euro: number;
  parallel: number;
  usdChange: number;
  eurChange: number;
  usdtChange: number;
  parallelUpdate: string;
  lastUpdate: string;
  nextRates: NextRates | null;
  history: HistoryPoint[];
  p2p: P2PRates;
}

interface DailyRateRow {
  rate_date: string;
  bcv_usd: number | string | null;
  bcv_eur: number | string | null;
  p2p_average: number | string | null;
  p2p_daily_average: number | string | null;
  p2p_buy_average: number | string | null;
  p2p_sell_average: number | string | null;
  p2p_sources: unknown;
  bcv_published_at: string | null;
  p2p_observed_at: string | null;
}

const DAILY_RATE_COLUMNS = [
  'rate_date',
  'bcv_usd',
  'bcv_eur',
  'p2p_average',
  'p2p_daily_average',
  'p2p_buy_average',
  'p2p_sell_average',
  'p2p_sources',
  'bcv_published_at',
  'p2p_observed_at',
].join(',');

const DAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function getTodayISO(): string {
  const now = new Date();
  const vetTime = now.getTime() - 4 * 60 * 60 * 1000;
  return new Date(vetTime).toISOString().split('T')[0];
}

function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function requireMobileBackend(): void {
  if (!isMobileBackendConfigured) {
    throw new Error('El backend de Kuanto Mobile todavía no está configurado.');
  }
}

function parseP2PDetails(details: unknown, average: number): P2PRates {
  const fallback: P2PRates = {
    binance: { buy: average, sell: average },
    bybit: { buy: average, sell: average },
  };

  if (!details || typeof details !== 'object' || Array.isArray(details)) return fallback;
  const sources = details as Record<string, unknown>;

  const pick = (source: unknown): P2PPair => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      const value = toNumber(source) || average;
      return { buy: value, sell: value };
    }

    const pair = source as Record<string, unknown>;
    return {
      buy: toNumber(pair.buy) || average,
      sell: toNumber(pair.sell) || average,
    };
  };

  return {
    binance: pick(sources.binance),
    bybit: pick(sources.bybit),
  };
}

function buildNextRates(row: DailyRateRow): NextRates {
  const [year, month, day] = row.rate_date.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return {
    usd: toNumber(row.bcv_usd),
    eur: toNumber(row.bcv_eur),
    date: `${DAY_LABELS[date.getDay()]} (${day.padStart(2, '0')}/${month.padStart(2, '0')})`,
    rawDate: row.rate_date,
  };
}

/** Obtiene la información necesaria para la pantalla principal en una consulta. */
export async function fetchAllRates(): Promise<Rates> {
  requireMobileBackend();
  const today = getTodayISO();
  const { data, error } = await supabase
    .from('daily_rates')
    .select(DAILY_RATE_COLUMNS)
    .order('rate_date', { ascending: false })
    .limit(45);

  if (error) {
    throw new Error(`No se pudieron cargar las tasas: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as DailyRateRow[];
  const bcvRows = rows.filter((row) => toNumber(row.bcv_usd) > 0 && toNumber(row.bcv_eur) > 0);
  const currentBcv = bcvRows.find((row) => row.rate_date <= today) ?? null;
  const bcvHistory = bcvRows.filter((row) => row.rate_date <= today);

  const futureBcv = bcvRows
    .filter((row) => row.rate_date > today)
    .sort((a, b) => a.rate_date.localeCompare(b.rate_date))[0] ?? null;

  const p2pRows = rows.filter(
    (row) => row.rate_date <= today && toNumber(row.p2p_average) > 0,
  );
  const currentP2p = p2pRows[0] ?? null;

  if (!currentBcv && !currentP2p) {
    throw new Error('El backend móvil no devolvió tasas válidas.');
  }

  const bcv = toNumber(currentBcv?.bcv_usd);
  const euro = toNumber(currentBcv?.bcv_eur);
  const parallel = toNumber(currentP2p?.p2p_average);

  const history: HistoryPoint[] = bcvHistory.map((row) => ({
    date: row.rate_date,
    usd: toNumber(row.bcv_usd),
    eur: toNumber(row.bcv_eur),
  }));

  return {
    bcv,
    euro,
    parallel,
    usdChange: calculateChange(bcv, toNumber(bcvHistory[1]?.bcv_usd)),
    eurChange: calculateChange(euro, toNumber(bcvHistory[1]?.bcv_eur)),
    usdtChange: calculateChange(
      parallel,
      toNumber(p2pRows[1]?.p2p_daily_average ?? p2pRows[1]?.p2p_average),
    ),
    parallelUpdate: currentP2p?.p2p_observed_at
      ? formatTime(new Date(currentP2p.p2p_observed_at))
      : 'Sin datos',
    lastUpdate: buildLastUpdateLabel(currentBcv?.rate_date ?? '', today),
    nextRates: futureBcv ? buildNextRates(futureBcv) : null,
    history: history.slice(0, 30),
    p2p: parseP2PDetails(currentP2p?.p2p_sources, parallel),
  };
}

function buildLastUpdateLabel(bcvDate: string, todayISO: string): string {
  if (!bcvDate) return 'Sin datos';

  const vetTime = Date.now() - 4 * 60 * 60 * 1000;
  const yesterday = new Date(vetTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split('T')[0];

  if (bcvDate === todayISO) return 'Hoy, 5:00pm';
  if (bcvDate === yesterdayISO) return 'Ayer, 5:00pm';

  const [year, month, day] = bcvDate.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = date.toLocaleDateString('es-VE', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}/${month}/${year.slice(-2)}, 5:00pm`;
}

function formatTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

export type HistorySeries = 'usd' | 'eur' | 'parallel';
export type HistoryPeriod = 'week' | 'month' | 'year';

export interface HistoryEntry {
  date: string;
  value: number;
}

function getDateByPeriod(period: HistoryPeriod): string {
  const now = new Date();
  const date = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  if (period === 'week') date.setDate(date.getDate() - 7);
  else if (period === 'month') date.setDate(date.getDate() - 30);
  else date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0];
}

export async function fetchSeriesHistory(
  series: HistorySeries,
  period: HistoryPeriod,
): Promise<HistoryEntry[]> {
  requireMobileBackend();
  const column = series === 'usd'
    ? 'bcv_usd'
    : series === 'eur'
      ? 'bcv_eur'
      : 'p2p_daily_average';
  const { data, error } = await supabase
    .from('daily_rates')
    .select(`rate_date, ${column}`)
    .gte('rate_date', getDateByPeriod(period))
    .lte('rate_date', getTodayISO())
    .not(column, 'is', null)
    .order('rate_date', { ascending: true })
    .limit(500);

  if (error) throw new Error(`No se pudo cargar el historial: ${error.message}`);

  return ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .map((row) => ({ date: String(row.rate_date), value: toNumber(row[column]) }))
    .filter((entry) => entry.value > 0);
}

export interface DateRates {
  requestedDate: string;
  bcvDate: string | null;
  usd: number;
  eur: number;
  usdChange: number;
  eurChange: number;
  parallel: number | null;
  isExact: boolean;
}

export async function fetchRatesByDate(dateISO: string): Promise<DateRates> {
  requireMobileBackend();
  const bcvPromise = supabase
    .from('daily_rates')
    .select('rate_date, bcv_usd, bcv_eur')
    .lte('rate_date', dateISO)
    .not('bcv_usd', 'is', null)
    .not('bcv_eur', 'is', null)
    .order('rate_date', { ascending: false })
    .limit(2);

  const p2pPromise = supabase
    .from('daily_rates')
    .select('p2p_daily_average')
    .eq('rate_date', dateISO)
    .maybeSingle();

  const [bcvResult, p2pResult] = await Promise.all([bcvPromise, p2pPromise]);
  if (bcvResult.error && p2pResult.error) {
    throw new Error('No se pudieron consultar las tasas de esa fecha.');
  }

  const bcvRows = (bcvResult.data ?? []) as unknown as Array<{
    rate_date: string;
    bcv_usd: number | string;
    bcv_eur: number | string;
  }>;
  const current = bcvRows[0];
  const previous = bcvRows[1];
  const usd = toNumber(current?.bcv_usd);
  const eur = toNumber(current?.bcv_eur);
  const parallelValue = toNumber(
    (p2pResult.data as unknown as { p2p_daily_average?: unknown } | null)?.p2p_daily_average,
  );

  return {
    requestedDate: dateISO,
    bcvDate: current?.rate_date ?? null,
    usd,
    eur,
    usdChange: calculateChange(usd, toNumber(previous?.bcv_usd)),
    eurChange: calculateChange(eur, toNumber(previous?.bcv_eur)),
    parallel: parallelValue > 0 ? parallelValue : null,
    isExact: current?.rate_date === dateISO,
  };
}

export async function fetchHistoricalRates(
  period: 'week' | 'month' | 'year' | 'all' = 'week',
  fromDateOverride?: string,
): Promise<HistoryPoint[]> {
  requireMobileBackend();
  const fromDate = fromDateOverride ?? getDateByPeriodExtended(period);
  try {
    const rows = await fetchDailyHistoryRows(
      'rate_date, bcv_usd, bcv_eur',
      ['bcv_usd', 'bcv_eur'],
      fromDate,
    );
    return rows.map((row) => ({
      date: String(row.rate_date),
      usd: toNumber(row.bcv_usd),
      eur: toNumber(row.bcv_eur),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`No se pudo cargar el histórico BCV: ${message}`);
  }
}

export interface UsdtHistoryPoint {
  date: string;
  usdt: number;
}

const HISTORY_PAGE_SIZE = 1000;
const HISTORY_MAX_PAGES = 10;

async function fetchDailyHistoryRows(
  columns: string,
  requiredColumns: string[],
  fromDate: string,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let page = 0; page < HISTORY_MAX_PAGES; page += 1) {
    let query = supabase
      .from('daily_rates')
      .select(columns)
      .gte('rate_date', fromDate)
      .order('rate_date', { ascending: false })
      .range(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE - 1);

    for (const column of requiredColumns) {
      query = query.not(column, 'is', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const pageRows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    rows.push(...pageRows);
    if (pageRows.length < HISTORY_PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchUsdtHistory(
  period: 'week' | 'month' | 'year' | 'all' = 'week',
  fromDateOverride?: string,
): Promise<UsdtHistoryPoint[]> {
  requireMobileBackend();
  const fromDate = fromDateOverride ?? getDateByPeriodExtended(period);
  try {
    const rows = await fetchDailyHistoryRows(
      'rate_date, p2p_daily_average',
      ['p2p_daily_average'],
      fromDate,
    );
    return rows
      .map((row) => ({ date: String(row.rate_date), usdt: toNumber(row.p2p_daily_average) }))
      .filter((row) => row.usdt > 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`No se pudo cargar el histórico USDT: ${message}`);
  }
}

export function fetchUsdtDailyAverages(
  period: 'week' | 'month' | 'year' | 'all' = 'week',
  fromDateOverride?: string,
): Promise<UsdtHistoryPoint[]> {
  return fetchUsdtHistory(period, fromDateOverride);
}

function getDateByPeriodExtended(period: 'week' | 'month' | 'year' | 'all'): string {
  const now = new Date();
  const date = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  if (period === 'week') date.setDate(date.getDate() - 7);
  else if (period === 'month') date.setDate(date.getDate() - 30);
  else if (period === 'year') date.setFullYear(date.getFullYear() - 1);
  else date.setFullYear(2020, 0, 1);
  return date.toISOString().split('T')[0];
}
