// Foreign-exchange layer. Base currency is always ZAR (the spa's source-of-truth
// price); PayPal cannot process ZAR, so USD/EUR charge amounts are derived here.
//
// Rates are cached in app.fx_rates and refreshed from a free live feed when
// stale. An owner-set markup % (app.pricing_config.fx_markup_pct) is applied on
// top so the spa keeps a margin against FX spread + PayPal fees. If the feed is
// unreachable we fall back to the last cached rate, then to a hard floor — a
// checkout never breaks on an FX outage.

import { supabaseAdmin } from './supabase.server';
import { getPricingConfig } from './services.server';

export type Currency = 'ZAR' | 'USD' | 'EUR';
export type QuoteCurrency = 'USD' | 'EUR';

const FX_TTL_MS = 60 * 60 * 1000; // refresh at most hourly
const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/ZAR';

// Absolute last-resort floors (roughly ZAR→quote) if the cache is empty AND the
// feed is down. Matches the seed in migration 0004.
const HARD_FALLBACK: Record<QuoteCurrency, number> = { USD: 0.053, EUR: 0.049 };

export interface Quote {
  currency: Currency;
  /** Amount to charge, in `currency`, rounded to 2dp. */
  amount: number;
  /** Original ZAR base amount. */
  baseZar: number;
  /** Effective ZAR→currency rate incl. markup (1 for ZAR). */
  rate: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function readCachedRate(quote: QuoteCurrency): Promise<{ rate: number; fetchedAt: number } | null> {
  const { data, error } = await supabaseAdmin
    .from('fx_rates')
    .select('rate, fetched_at')
    .eq('quote_currency', quote)
    .maybeSingle();
  if (error) {
    console.error('[fx] readCachedRate failed:', error);
    return null;
  }
  if (!data) return null;
  return { rate: Number(data.rate), fetchedAt: new Date(data.fetched_at).getTime() };
}

/**
 * One API call returns every rate, so refresh USD and EUR together and write
 * both back to the cache.
 */
async function refreshRates(): Promise<void> {
  const res = await fetch(FX_ENDPOINT, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`fx feed ${res.status}`);
  const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (body.result !== 'success' || !body.rates) throw new Error('fx feed bad payload');

  const now = new Date().toISOString();
  const rows = (['USD', 'EUR'] as QuoteCurrency[])
    .map((q) => ({ quote_currency: q, rate: body.rates![q], fetched_at: now }))
    .filter((r) => typeof r.rate === 'number' && r.rate > 0);

  if (rows.length) {
    const { error } = await supabaseAdmin.from('fx_rates').upsert(rows, { onConflict: 'quote_currency' });
    if (error) console.error('[fx] cache upsert failed:', error);
  }
}

/**
 * ZAR→quote rate, refreshing the cache if older than the TTL. Never throws:
 * degrades to the stale cached rate, then to a hard fallback.
 */
async function getRate(quote: QuoteCurrency): Promise<number> {
  const cached = await readCachedRate(quote);
  const fresh = cached && Date.now() - cached.fetchedAt < FX_TTL_MS;
  if (cached && fresh) return cached.rate;

  try {
    await refreshRates();
  } catch (err) {
    console.error('[fx] refresh failed, using cached/fallback:', err);
  }

  const after = await readCachedRate(quote);
  if (after) return after.rate;
  return cached?.rate ?? HARD_FALLBACK[quote];
}

/**
 * Convert a ZAR amount into a charge amount for the requested currency, applying
 * the owner's FX markup. ZAR passes through unchanged.
 */
export async function quoteAmount(zar: number, currency: Currency): Promise<Quote> {
  if (currency === 'ZAR') {
    return { currency, amount: round2(zar), baseZar: zar, rate: 1 };
  }
  const { fxMarkupPct } = await getPricingConfig();
  const base = await getRate(currency);
  const rate = base * (1 + fxMarkupPct / 100);
  return { currency, amount: round2(zar * rate), baseZar: zar, rate };
}
