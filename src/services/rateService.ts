import { supabase } from './supabaseClient';

/**
 * Núcleo de datos — portado de src/services/rateService.js (repo original).
 * Las tasas BCV (USD/EUR) y el paralelo (P2P/USDT) provienen de Supabase,
 * alimentado por el scraper de Vercel + agregador P2P.
 */

export interface HistoryPoint {
  date: string;
  usd: number;
  eur: number;
}

export interface NextRates {
  usd: number;
  eur: number;
  date: string; // etiqueta legible, p. ej. "Lunes (09/06)"
  rawDate: string; // YYYY-MM-DD
}

export interface P2PPair {
  buy: number; // compra
  sell: number; // venta
}

export interface P2PRates {
  binance: P2PPair;
  bybit: P2PPair;
  yadio: P2PPair;
}

export interface Rates {
  bcv: number; // USD BCV
  euro: number; // EUR BCV
  parallel: number; // Promedio paralelo (USDT)
  usdChange: number; // % cambio 24h
  eurChange: number;
  usdtChange: number;
  parallelUpdate: string;
  lastUpdate: string;
  nextRates: NextRates | null;
  history: HistoryPoint[];
  p2p: P2PRates; // desglose por fuente (compra/venta)
}

// --- Helpers ---

/** Fecha de hoy (YYYY-MM-DD) ajustada a hora de Venezuela (UTC-4). */
function getTodayISO(): string {
  const now = new Date();
  const vetTime = now.getTime() - 4 * 60 * 60 * 1000;
  return new Date(vetTime).toISOString().split('T')[0];
}

/** Variación porcentual entre dos valores. */
function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return isNaN(n) ? 0 : n;
}

/** Parsea el campo `details` del P2P en compra/venta por fuente (con respaldo al promedio). */
function parseP2PDetails(details: unknown, avg: number): P2PRates {
  const fallback: P2PRates = {
    binance: { buy: avg, sell: avg },
    bybit: { buy: avg, sell: avg },
    yadio: { buy: avg, sell: avg },
  };

  let obj: Record<string, unknown> | null = null;
  if (typeof details === 'string') {
    try {
      obj = JSON.parse(details);
    } catch {
      obj = null;
    }
  } else if (details && typeof details === 'object') {
    obj = details as Record<string, unknown>;
  }
  if (!obj) return fallback;

  const pick = (src: unknown): P2PPair => {
    if (src && typeof src === 'object' && 'buy' in (src as Record<string, unknown>)) {
      const s = src as { buy?: unknown; sell?: unknown };
      return { buy: toNumber(s.buy) || avg, sell: toNumber(s.sell) || avg };
    }
    const v = toNumber(src) || avg;
    return { buy: v, sell: v };
  };

  return {
    binance: pick(obj.binance),
    bybit: pick(obj.bybit),
    yadio: pick(obj.yadio),
  };
}

const DAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

/**
 * Obtiene todas las tasas actuales (BCV USD/EUR + paralelo) con sus variaciones.
 */
export async function fetchAllRates(): Promise<Rates> {
  const todayStr = getTodayISO();

  // Histórico BCV (incluye posible tasa futura ya publicada)
  const historyPromise = supabase
    .from('bcv_rates_history')
    .select('date, usd, eur')
    .order('date', { ascending: false })
    .limit(40);

  // P2P de los últimos ~3 días (margen por fines de semana / zona horaria)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoISO = threeDaysAgo.toISOString().split('T')[0];

  const p2pHistoryPromise = supabase
    .from('p2p_rate_history')
    .select('price, details, created_at')
    .gte('created_at', `${threeDaysAgoISO}T00:00:00.000Z`)
    .order('created_at', { ascending: false });

  const [historyResult, p2pHistoryResult] = await Promise.allSettled([
    historyPromise,
    p2pHistoryPromise,
  ]);

  // --- Procesar BCV ---
  let usdBCV = 0;
  let eurBCV = 0;
  let bcvDateFound = todayStr;
  let nextRateData: NextRates | null = null;
  let recentHistory: HistoryPoint[] = [];

  if (
    historyResult.status === 'fulfilled' &&
    historyResult.value.data &&
    !historyResult.value.error
  ) {
    const rows = historyResult.value.data as Array<{
      date: string;
      usd: number | string;
      eur: number | string;
    }>;

    const normalized: HistoryPoint[] = rows.map((r) => ({
      date: r.date,
      usd: toNumber(r.usd),
      eur: toNumber(r.eur),
    }));

    // Última tasa con fecha <= hoy
    const current = normalized.find((r) => r.date <= todayStr) ?? null;
    if (current) {
      usdBCV = current.usd;
      eurBCV = current.eur;
      bcvDateFound = current.date;
    }

    // Tasa futura ya publicada (feature "próximas tasas")
    const potentialFuture = normalized[0];
    if (potentialFuture && potentialFuture.date > todayStr) {
      const [y, m, d] = potentialFuture.date.split('-');
      const nextDateObj = new Date(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
      );
      nextRateData = {
        usd: potentialFuture.usd,
        eur: potentialFuture.eur,
        date: `${DAY_LABELS[nextDateObj.getDay()]} (${d.padStart(2, '0')}/${m.padStart(2, '0')})`,
        rawDate: potentialFuture.date,
      };
      recentHistory = normalized.filter((r) => r.date <= todayStr);
    } else {
      recentHistory = normalized;
    }
  } else {
    console.warn('[RateService] Falló la consulta BCV en Supabase');
  }

  // Variación 24h USD/EUR (vs. día anterior en el histórico)
  let usdChange = 0;
  let eurChange = 0;
  if (recentHistory.length >= 2) {
    const yesterday = recentHistory[1];
    usdChange = calculateChange(usdBCV, yesterday.usd);
    eurChange = calculateChange(eurBCV, yesterday.eur);
  }

  // --- Procesar paralelo (P2P) ---
  let parallel = 0;
  let usdtChange = 0;
  let p2p: P2PRates = {
    binance: { buy: 0, sell: 0 },
    bybit: { buy: 0, sell: 0 },
    yadio: { buy: 0, sell: 0 },
  };

  if (
    p2pHistoryResult.status === 'fulfilled' &&
    p2pHistoryResult.value.data &&
    !p2pHistoryResult.value.error
  ) {
    const p2pRows = p2pHistoryResult.value.data as Array<{
      price: number | string;
      details?: unknown;
      created_at: string;
    }>;

    if (p2pRows.length > 0) {
      // El más reciente es el primero (orden desc)
      parallel = toNumber(p2pRows[0].price);
      p2p = parseP2PDetails(p2pRows[0].details, parallel);

      // Promedios diarios (en hora de Venezuela) para la variación 24h
      const dailySums: Record<string, { sum: number; count: number }> = {};
      for (const item of p2pRows) {
        const utc = new Date(item.created_at);
        const vet = new Date(utc.getTime() - 4 * 60 * 60 * 1000);
        const dateStr = vet.toISOString().split('T')[0];
        const price = toNumber(item.price);
        if (price <= 0) continue;
        if (!dailySums[dateStr]) dailySums[dateStr] = { sum: 0, count: 0 };
        dailySums[dateStr].sum += price;
        dailySums[dateStr].count += 1;
      }

      const dailyAverages = Object.entries(dailySums)
        .map(([date, { sum, count }]) => ({ date, usdt: count > 0 ? sum / count : 0 }))
        .filter((d) => d.usdt > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (dailyAverages.length >= 2 && dailyAverages[1].usdt > 0) {
        usdtChange = calculateChange(dailyAverages[0].usdt, dailyAverages[1].usdt);
      }
    }
  } else {
    console.warn('[RateService] Falló la consulta P2P en Supabase');
  }

  // --- Etiqueta de última actualización BCV ---
  const lastUpdate = buildLastUpdateLabel(bcvDateFound, todayStr);

  return {
    bcv: usdBCV,
    euro: eurBCV,
    parallel,
    usdChange,
    eurChange,
    usdtChange,
    parallelUpdate: formatTime(new Date()),
    lastUpdate,
    nextRates: nextRateData,
    history: recentHistory.slice(0, 30),
    p2p,
  };
}

function buildLastUpdateLabel(bcvDate: string, todayISO: string): string {
  if (!bcvDate) return 'Sin datos';

  const bcvTypicalTime = '5:00pm';

  // Ayer (en hora de Venezuela)
  const vetTime = Date.now() - 4 * 60 * 60 * 1000;
  const yesterday = new Date(vetTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split('T')[0];

  if (bcvDate === todayISO) return `Hoy, ${bcvTypicalTime}`;
  if (bcvDate === yesterdayISO) return `Ayer, ${bcvTypicalTime}`;

  const [y, m, d] = bcvDate.split('-');
  const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  const dayName = dateObj.toLocaleDateString('es-VE', { weekday: 'long' });
  const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${cap} ${d}/${m}/${y.slice(-2)}, ${bcvTypicalTime}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

// --- Historial para gráficos ---

export type HistorySeries = 'usd' | 'eur' | 'parallel';
export type HistoryPeriod = 'week' | 'month' | 'year';

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  value: number;
}

function getDateByPeriod(period: HistoryPeriod): string {
  const now = new Date();
  const vetTime = now.getTime() - 4 * 60 * 60 * 1000;
  const d = new Date(vetTime);
  if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setDate(d.getDate() - 30);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

/** Historial de una serie (USD/EUR BCV o paralelo USDT) para el periodo dado. */
export async function fetchSeriesHistory(
  series: HistorySeries,
  period: HistoryPeriod,
): Promise<HistoryEntry[]> {
  const fromDate = getDateByPeriod(period);

  if (series === 'parallel') {
    // P2P: paginar y promediar por día (hora de Venezuela)
    let all: Array<{ price: number | string; created_at: string }> = [];
    const pageSize = 1000;
    for (let page = 0; page < 30; page++) {
      const { data, error } = await supabase
        .from('p2p_rate_history')
        .select('price, created_at')
        .gte('created_at', `${fromDate}T00:00:00.000Z`)
        .order('created_at', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data as typeof all);
      if (data.length < pageSize) break;
    }

    const daily: Record<string, { sum: number; count: number }> = {};
    for (const item of all) {
      const utc = new Date(item.created_at);
      const vet = new Date(utc.getTime() - 4 * 60 * 60 * 1000);
      const ds = vet.toISOString().split('T')[0];
      const price = toNumber(item.price);
      if (price <= 0) continue;
      if (!daily[ds]) daily[ds] = { sum: 0, count: 0 };
      daily[ds].sum += price;
      daily[ds].count += 1;
    }
    return Object.entries(daily)
      .map(([date, { sum, count }]) => ({ date, value: count > 0 ? sum / count : 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // BCV (USD o EUR): una fila por día
  const { data, error } = await supabase
    .from('bcv_rates_history')
    .select(`date, ${series}`)
    .gte('date', fromDate)
    .lte('date', getTodayISO())
    .order('date', { ascending: true })
    .limit(5000);

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>)
    .map((r) => ({ date: r.date as string, value: toNumber(r[series]) }))
    .filter((e) => e.value > 0);
}

// --- Búsqueda de tasa por fecha (calendario) ---

export interface DateRates {
  /** Fecha solicitada (YYYY-MM-DD). */
  requestedDate: string;
  /** Fecha BCV efectiva (<= solicitada); null si no hay datos. */
  bcvDate: string | null;
  usd: number;
  eur: number;
  usdChange: number;
  eurChange: number;
  /** Promedio USDT de ese día (en hora de Venezuela), o null si no hay datos. */
  parallel: number | null;
  /** true si la fecha BCV coincide exactamente con la solicitada. */
  isExact: boolean;
}

/**
 * Tasas vigentes en una fecha histórica dada (buscador de calendario).
 * El BCV no publica fines de semana/feriados: se devuelve la última tasa
 * con fecha <= la solicitada. El paralelo se promedia para ese día (VET).
 */
export async function fetchRatesByDate(dateISO: string): Promise<DateRates> {
  // BCV: fila vigente = la más reciente con date <= fecha solicitada (+ anterior para variación).
  const bcvPromise = supabase
    .from('bcv_rates_history')
    .select('date, usd, eur')
    .lte('date', dateISO)
    .order('date', { ascending: false })
    .limit(2);

  // P2P: ventana del día solicitado en hora de Venezuela (UTC-4 → medianoche VET = 04:00 UTC).
  const startUTC = `${dateISO}T04:00:00.000Z`;
  const [y, m, d] = dateISO.split('-').map((n) => parseInt(n, 10));
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const nextISO = nextDay.toISOString().split('T')[0];
  const endUTC = `${nextISO}T04:00:00.000Z`;

  const p2pPromise = supabase
    .from('p2p_rate_history')
    .select('price')
    .gte('created_at', startUTC)
    .lt('created_at', endUTC)
    .limit(3000);

  const [bcvResult, p2pResult] = await Promise.allSettled([bcvPromise, p2pPromise]);

  let usd = 0;
  let eur = 0;
  let bcvDate: string | null = null;
  let usdChange = 0;
  let eurChange = 0;

  if (bcvResult.status === 'fulfilled' && bcvResult.value.data && !bcvResult.value.error) {
    const rows = bcvResult.value.data as Array<{
      date: string;
      usd: number | string;
      eur: number | string;
    }>;
    if (rows.length > 0) {
      usd = toNumber(rows[0].usd);
      eur = toNumber(rows[0].eur);
      bcvDate = rows[0].date;
      if (rows.length > 1) {
        usdChange = calculateChange(usd, toNumber(rows[1].usd));
        eurChange = calculateChange(eur, toNumber(rows[1].eur));
      }
    }
  }

  let parallel: number | null = null;
  if (p2pResult.status === 'fulfilled' && p2pResult.value.data && !p2pResult.value.error) {
    const rows = p2pResult.value.data as Array<{ price: number | string }>;
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const p = toNumber(r.price);
      if (p > 0) {
        sum += p;
        count += 1;
      }
    }
    if (count > 0) parallel = sum / count;
  }

  return {
    requestedDate: dateISO,
    bcvDate,
    usd,
    eur,
    usdChange,
    eurChange,
    parallel,
    isExact: bcvDate === dateISO,
  };
}

/**
 * Obtiene el histórico de tasas BCV (USD/EUR) desde Supabase.
 */
export async function fetchHistoricalRates(
  period: 'week' | 'month' | 'year' | 'all' = 'week',
  fromDateOverride?: string
): Promise<HistoryPoint[]> {
  try {
    const fromDate = fromDateOverride ?? getDateByPeriodExtended(period);
    console.log(`[RateService] Fetching historical rates from Supabase since ${fromDate}`);

    const { data, error } = await supabase
      .from('bcv_rates_history')
      .select('date, usd, eur')
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[RateService] Supabase error fetching historical rates:', error);
      return [];
    }

    if (!data) return [];

    return data.map((r) => ({
      date: r.date,
      usd: toNumber(r.usd),
      eur: toNumber(r.eur),
    }));
  } catch (error) {
    console.error('[RateService] Error fetching historical rates:', error);
    return [];
  }
}

export interface UsdtHistoryPoint {
  date: string;
  usdt: number;
}

/**
 * Obtiene el histórico de USDT P2P de Supabase y calcula los promedios diarios.
 */
export async function fetchUsdtHistory(
  period: 'week' | 'month' | 'year' | 'all' = 'week',
  fromDateOverride?: string
): Promise<UsdtHistoryPoint[]> {
  try {
    const fromDate = fromDateOverride ?? getDateByPeriodExtended(period);
    let allData: { price: number | string; created_at: string }[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;

    while (hasMore) {
      const { data, error } = await supabase
        .from('p2p_rate_history')
        .select('price, created_at')
        .gte('created_at', `${fromDate}T00:00:00.000Z`)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('[RateService] Error fetching USDT history from Supabase:', error);
        return [];
      }

      if (data && data.length > 0) {
        allData = allData.concat(
          data.map((d) => ({
            price: d.price,
            created_at: d.created_at,
          }))
        );
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }

      if (page >= 30) {
        console.warn('[RateService] Safety limit reached while fetching USDT history.');
        hasMore = false;
      }
    }

    if (allData.length === 0) {
      return [];
    }

    const dailyData: Record<string, { sum: number; count: number }> = {};

    allData.forEach((item) => {
      const utcDate = new Date(item.created_at);
      const vetDate = new Date(utcDate.getTime() - 4 * 60 * 60 * 1000);
      const dateStr = vetDate.toISOString().split('T')[0];

      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { sum: 0, count: 0 };
      }

      const price = toNumber(item.price);
      if (price > 0) {
        dailyData[dateStr].sum += price;
        dailyData[dateStr].count++;
      }
    });

    return Object.keys(dailyData)
      .map((date) => ({
        date,
        usdt: dailyData[date].count > 0 ? dailyData[date].sum / dailyData[date].count : 0,
      }))
      .filter((item) => item.usdt > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('[RateService] Error in fetchUsdtHistory:', error);
    return [];
  }
}

/**
 * Promedios diarios de USDT desde la vista agregada `p2p_daily_avg` (rápido:
 * ~1 fila por día en vez de miles de ticks). Si la vista todavía no existe en
 * Supabase, cae automáticamente al método por ticks (`fetchUsdtHistory`).
 * Crea la vista con `db/p2p_daily_avg.sql`.
 */
export async function fetchUsdtDailyAverages(
  period: 'week' | 'month' | 'year' | 'all' = 'week',
  fromDateOverride?: string
): Promise<UsdtHistoryPoint[]> {
  const fromDate = fromDateOverride ?? getDateByPeriodExtended(period);

  const { data, error } = await supabase
    .from('p2p_daily_avg')
    .select('day, usdt')
    .gte('day', fromDate)
    .order('day', { ascending: false })
    .limit(5000);

  if (error || !data) {
    // La vista no existe aún (o falló): respaldo descargando ticks.
    console.warn('[RateService] p2p_daily_avg no disponible, usando ticks:', error?.message);
    return fetchUsdtHistory(period, fromDateOverride);
  }

  return (data as Array<{ day: string; usdt: number | string }>)
    .map((r) => ({ date: r.day, usdt: toNumber(r.usdt) }))
    .filter((e) => e.usdt > 0);
}

/**
 * Obtiene la fecha límite según el periodo, incluyendo soporte para 'all' (desde 2020).
 */
function getDateByPeriodExtended(period: 'week' | 'month' | 'year' | 'all'): string {
  const now = new Date();
  const vetTime = now.getTime() - 4 * 60 * 60 * 1000;
  const d = new Date(vetTime);

  if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setDate(d.getDate() - 30);
  else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
  else if (period === 'all') d.setFullYear(2020, 0, 1);

  return d.toISOString().split('T')[0];
}

