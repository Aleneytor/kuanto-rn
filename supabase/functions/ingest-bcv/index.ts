import { callAdminRpc } from '../_shared/adminRpc.ts';
import { errorResponse, HttpError, jsonResponse, requireCronAuth } from '../_shared/cronAuth.ts';

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    requireCronAuth(request);

    const feedUrl = Deno.env.get('BCV_FEED_URL');
    if (!feedUrl?.startsWith('https://')) throw new Error('BCV_FEED_URL is not configured.');

    const response = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`BCV feed failed with HTTP ${response.status}.`);
    const body = await response.json();
    if (body?.success === false) throw new Error('BCV feed reported failure.');

    const rateDate = validateDate(body?.date);
    const usd = positiveNumber(body?.usd, 'USD');
    const eur = positiveNumber(body?.eur, 'EUR');
    const publishedAt = new Date().toISOString();

    const storedDate = await callAdminRpc<string>('record_bcv_ingestion', {
      p_rate_date: rateDate,
      p_usd: usd,
      p_eur: eur,
      p_published_at: publishedAt,
      p_source: 'bcv-feed',
    });

    return jsonResponse({ success: true, rateDate: storedDate, usd, eur, publishedAt });
  } catch (error) {
    return errorResponse(error);
  }
});

function validateDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('BCV feed returned an invalid date.');
  }
  return value;
}

function positiveNumber(value: unknown, currency: string): number {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`BCV feed returned an invalid ${currency} rate.`);
  }
  return number;
}
