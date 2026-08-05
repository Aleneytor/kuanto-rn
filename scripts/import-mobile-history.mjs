const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 250;

const sourceUrl = requireEnv('SOURCE_SUPABASE_URL');
const sourceKey = requireEnv('SOURCE_SUPABASE_PUBLISHABLE_KEY');
const targetUrl = requireEnv('TARGET_SUPABASE_URL');
const targetSecretKey = requireEnv('TARGET_SUPABASE_SECRET_KEY');
const shouldApply = process.argv.includes('--apply');

if (sourceUrl === targetUrl) {
  throw new Error('El origen y el destino no pueden ser el mismo proyecto.');
}

if (!targetSecretKey.startsWith('sb_secret_')) {
  throw new Error('TARGET_SUPABASE_SECRET_KEY debe ser una secret key nueva (sb_secret_...).');
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value.replace(/\/$/, '');
}

function sourceHeaders() {
  return {
    apikey: sourceKey,
    Authorization: `Bearer ${sourceKey}`,
  };
}

function targetHeaders(extra = {}) {
  return {
    apikey: targetSecretKey,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function readJson(response, context) {
  if (response.ok) return response.json();
  const body = await response.text();
  throw new Error(`${context}: HTTP ${response.status} ${body.slice(0, 300)}`);
}

async function fetchAll(resource, select, orderColumn) {
  const rows = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({
      select,
      order: `${orderColumn}.asc`,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const response = await fetch(`${sourceUrl}/rest/v1/${resource}?${query}`, {
      headers: sourceHeaders(),
    });
    const page = await readJson(response, `Lectura de ${resource}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function positiveNumber(value, label) {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Valor inválido en ${label}: ${String(value)}`);
  }
  return number;
}

function assertDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Fecha inválida en ${label}: ${String(value)}`);
  }
  return value;
}

function venezuelaDate(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) throw new Error(`Timestamp P2P inválido: ${isoTimestamp}`);
  return new Date(date.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeDetails(details) {
  if (!details) return {};
  if (typeof details === 'string') {
    try {
      return normalizeDetails(JSON.parse(details));
    } catch {
      return {};
    }
  }
  return typeof details === 'object' && !Array.isArray(details) ? details : {};
}

function averageSourceSide(details, side) {
  const values = Object.values(details)
    .map((source) => {
      if (typeof source === 'number' || typeof source === 'string') return Number(source);
      return source && typeof source === 'object' ? Number(source[side]) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function selectedP2pSources(details) {
  const normalized = normalizeDetails(details);
  const selected = {};

  for (const provider of ['binance', 'bybit']) {
    const source = normalized[provider];
    if (!source || typeof source !== 'object') return null;
    const buy = Number(source.buy);
    const sell = Number(source.sell);
    if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(sell) || sell <= 0) return null;
    selected[provider] = { buy, sell };
  }

  return selected;
}

function aggregateSelectedP2p(ticks) {
  const days = new Map();
  let latestTick = null;

  for (const tick of ticks) {
    const details = selectedP2pSources(tick.details);
    if (!details) continue;

    const buy = averageSourceSide(details, 'buy');
    const sell = averageSourceSide(details, 'sell');
    if (!buy || !sell) continue;

    const day = venezuelaDate(tick.created_at);
    const aggregate = days.get(day) ?? { sum: 0, count: 0 };
    aggregate.sum += buy;
    aggregate.count += 1;
    days.set(day, aggregate);
    latestTick = { price: buy, details, created_at: tick.created_at };
  }

  return {
    p2pRows: [...days.entries()].map(([day, aggregate]) => ({
      day,
      usdt: aggregate.sum / aggregate.count,
    })),
    latestTick,
  };
}

function buildDailyRows(bcvRows, p2pRows, latestTick) {
  const byDate = new Map();

  for (const row of bcvRows) {
    const rateDate = assertDate(row.date, 'BCV');
    byDate.set(rateDate, {
      rate_date: rateDate,
      bcv_usd: positiveNumber(row.usd, `BCV USD ${rateDate}`),
      bcv_eur: positiveNumber(row.eur, `BCV EUR ${rateDate}`),
      bcv_published_at: row.created_at ?? null,
    });
  }

  for (const row of p2pRows) {
    const rateDate = assertDate(row.day, 'P2P diario');
    const current = byDate.get(rateDate) ?? { rate_date: rateDate };
    current.p2p_average = positiveNumber(row.usdt, `P2P ${rateDate}`);
    current.p2p_daily_average = current.p2p_average;
    current.p2p_sources = {};
    byDate.set(rateDate, current);
  }

  if (latestTick) {
    const rateDate = venezuelaDate(latestTick.created_at);
    const current = byDate.get(rateDate) ?? { rate_date: rateDate };
    const details = normalizeDetails(latestTick.details);
    current.p2p_average = positiveNumber(latestTick.price, `último P2P ${rateDate}`);
    current.p2p_buy_average = averageSourceSide(details, 'buy');
    current.p2p_sell_average = averageSourceSide(details, 'sell');
    current.p2p_sources = details;
    current.p2p_observed_at = latestTick.created_at;
    byDate.set(rateDate, current);
  }

  return [...byDate.values()]
    .map((row) => ({
      rate_date: row.rate_date,
      bcv_usd: row.bcv_usd ?? null,
      bcv_eur: row.bcv_eur ?? null,
      p2p_average: row.p2p_average ?? null,
      p2p_daily_average: row.p2p_daily_average ?? null,
      p2p_buy_average: row.p2p_buy_average ?? null,
      p2p_sell_average: row.p2p_sell_average ?? null,
      p2p_sources: row.p2p_sources ?? {},
      bcv_published_at: row.bcv_published_at ?? null,
      p2p_observed_at: row.p2p_observed_at ?? null,
    }))
    .sort((a, b) => a.rate_date.localeCompare(b.rate_date));
}

async function upsertRows(rows) {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const response = await fetch(`${targetUrl}/rest/v1/daily_rates?on_conflict=rate_date`, {
      method: 'POST',
      headers: targetHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Upsert ${index}-${index + batch.length}: HTTP ${response.status} ${body}`);
    }
    console.log(`Importadas ${Math.min(index + batch.length, rows.length)}/${rows.length} filas.`);
  }
}

async function clearTargetP2p() {
  const response = await fetch(`${targetUrl}/rest/v1/daily_rates?rate_date=gte.2020-01-01`, {
    method: 'PATCH',
    headers: targetHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      p2p_average: null,
      p2p_daily_average: null,
      p2p_buy_average: null,
      p2p_sell_average: null,
      p2p_sources: {},
      p2p_observed_at: null,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Limpieza P2P destino: HTTP ${response.status} ${body}`);
  }
}

async function verifyTarget(expectedRows) {
  const response = await fetch(
    `${targetUrl}/rest/v1/daily_rates?select=rate_date&order=rate_date.asc&limit=1`,
    { headers: targetHeaders({ Prefer: 'count=exact' }) },
  );
  if (!response.ok) throw new Error(`Verificación destino: HTTP ${response.status}`);
  const contentRange = response.headers.get('content-range');
  const total = Number.parseInt(contentRange?.split('/')[1] ?? '', 10);
  if (!Number.isFinite(total) || total < expectedRows) {
    throw new Error(`Conteo inesperado en destino: ${contentRange}; mínimo ${expectedRows}.`);
  }
  return total;
}

const [bcvRows, p2pTicks] = await Promise.all([
  fetchAll('bcv_rates_history', 'date,usd,eur,created_at', 'date'),
  fetchAll('p2p_rate_history', 'details,created_at', 'created_at'),
]);

const { p2pRows, latestTick } = aggregateSelectedP2p(p2pTicks);

const dailyRows = buildDailyRows(bcvRows, p2pRows, latestTick);
console.log(
  JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    sourceBcvRows: bcvRows.length,
    sourceP2pTicks: p2pTicks.length,
    sourceP2pDays: p2pRows.length,
    outputRows: dailyRows.length,
    firstDate: dailyRows[0]?.rate_date ?? null,
    lastDate: dailyRows.at(-1)?.rate_date ?? null,
  }),
);

if (!shouldApply) {
  console.log('Dry-run completo. Usa --apply para escribir en el proyecto móvil.');
} else {
  await clearTargetP2p();
  await upsertRows(dailyRows);
  const total = await verifyTarget(dailyRows.length);
  console.log(`Importación verificada: ${total} filas en daily_rates.`);
}
