// Pure core for silver-price-per-gram-mcp. The only I/O is two keyless upstream fetches
// (gold-api.com spot, Frankfurter FX), done through an injected fetchText.
import type { FetchText } from './types.js';

export const REPO = 'silver-price-per-gram-mcp';
export const SITE = 'https://goldgramprice.com';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const SPOT_API = 'https://api.gold-api.com/price';
export const FX_API = 'https://api.frankfurter.dev/v2/rates?base=USD';
export const SPOT_TTL = 300;
export const FX_TTL = 3600;
export const DATA_CHECKED = '2026-11-03';

export class InputError extends Error {}
export class UpstreamError extends Error {}

export const link = (path: string) => `${SITE}${path}?${UTM}`;
export const PAGE_SILVER = link('/silver-price-per-gram/');
export const PAGE_JUNK = link('/junk-silver-melt-value/');
export const PAGE_STERLING = link('/learn/sterling-vs-fine-silver/');
export const PAGE_EAGLE = link('/learn/how-much-silver-is-in-an-american-silver-eagle/');

// ---------------------------------------------------------------- units

export const NIST_HB44 = 'https://www.nist.gov/system/files/documents/2024/01/14/NIST%20HB%2044%202024%20Appendix%20C%20General%20Tables%20of%20Units%20of%20Measurement.pdf';
const GRAIN_G = 0.06479891; // exact, NIST HB44 Appendix C
export const TROY_OZ_G = 480 * GRAIN_G; // 31.1034768 exact

export interface UnitDef { grams: number; label: string; definition: string }

export const UNITS: Record<string, UnitDef> = {
  gram: { grams: 1, label: 'gram (g)', definition: 'SI unit' },
  kilogram: { grams: 1000, label: 'kilogram (kg)', definition: '1000 g' },
  troy_ounce: { grams: TROY_OZ_G, label: 'troy ounce (oz t)', definition: '480 grains = 31.1034768 g' },
  pennyweight: { grams: TROY_OZ_G / 20, label: 'pennyweight (dwt)', definition: '1/20 troy ounce = 1.55517384 g' },
  grain: { grams: GRAIN_G, label: 'grain (gr)', definition: '64.79891 mg' },
  avoirdupois_ounce: { grams: 28.349523125, label: 'avoirdupois ounce (oz, kitchen scale)', definition: '1/16 lb = 28.349523125 g' },
  pound: { grams: 453.59237, label: 'avoirdupois pound (lb)', definition: '453.59237 g' },
  troy_pound: { grams: 12 * TROY_OZ_G, label: 'troy pound', definition: '12 troy ounces = 373.2417216 g' },
  tola: { grams: 180 * GRAIN_G, label: 'tola (South Asia)', definition: '180 grains = 11.6638038 g' },
};
export const UNIT_NAMES = Object.keys(UNITS) as [string, ...string[]];

const UNIT_ALIASES: Record<string, string> = {
  g: 'gram', grams: 'gram', gm: 'gram', kg: 'kilogram', kilo: 'kilogram', kilos: 'kilogram', kilograms: 'kilogram',
  oz: 'troy_ounce', ozt: 'troy_ounce', 'oz t': 'troy_ounce', troy_oz: 'troy_ounce', ounce: 'troy_ounce', ounces: 'troy_ounce', troy_ounces: 'troy_ounce',
  dwt: 'pennyweight', gr: 'grain', grains: 'grain', lb: 'pound', lbs: 'pound', pounds: 'pound', tolas: 'tola', avdp_ounce: 'avoirdupois_ounce',
};

export function resolveUnit(u: string): string {
  const k = u.trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (UNITS[k]) return k;
  const a = UNIT_ALIASES[u.trim().toLowerCase()] ?? UNIT_ALIASES[k];
  if (a) return a;
  throw new InputError(`Unknown unit "${u}". Use one of: ${UNIT_NAMES.join(', ')}.`);
}

// ---------------------------------------------------------------- fineness

export const CFR_23_5 = 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23/section-23.5';
export const UK_HALLMARK = 'https://www.legislation.gov.uk/ukpga/1973/43/schedule/2';

export interface Grade { key: string; fineness: number; name: string; rule: string; source: string }

export const GRADES: Grade[] = [
  { key: 'fine', fineness: 999, name: 'Fine silver .999 (bullion bars and rounds)', rule: 'UK hallmark standard 999', source: UK_HALLMARK },
  { key: 'britannia', fineness: 958.4, name: 'Britannia silver .9584', rule: 'UK hallmark standard 958.4', source: UK_HALLMARK },
  { key: 'sterling', fineness: 925, name: 'Sterling silver .925', rule: '"Sterling" requires at least 925/1000 pure silver (16 CFR 23.5(b)(2)); UK hallmark standard 925', source: CFR_23_5 },
  { key: 'coin', fineness: 900, name: 'Coin silver .900 (US coins before 1965)', rule: '"Coin silver" requires at least 900/1000 pure silver (16 CFR 23.5(b)(3))', source: CFR_23_5 },
  { key: '800', fineness: 800, name: '800 silver (Continental Europe)', rule: 'UK hallmark standard 800', source: UK_HALLMARK },
];
const GRADE_ALIASES: Record<string, string> = {
  '999': 'fine', '.999': 'fine', pure: 'fine', fine_silver: 'fine', bullion: 'fine', '9999': 'fine',
  '958': 'britannia', '958.4': 'britannia', '.958': 'britannia', '925': 'sterling', '.925': 'sterling', sterling_silver: 'sterling',
  '900': 'coin', '.900': 'coin', '90%': 'coin', coin_silver: 'coin', '.800': '800',
};

/** Accepts a grade name (sterling, coin, britannia, fine), a fineness in parts per thousand (925), or a fraction (0.925). Returns parts per thousand. */
export function resolveFineness(x: string | number): { fineness: number; grade: Grade | null } {
  if (typeof x === 'number' || /^\s*[\d.]+\s*$/.test(String(x))) {
    let n = Number(x);
    if (n > 0 && n <= 1) n = n * 1000;
    if (!(n > 0 && n <= 1000)) throw new InputError(`Fineness must be parts per thousand from 1 to 1000 (925 for sterling) or a fraction such as 0.925. Got ${x}.`);
    return { fineness: n, grade: GRADES.find((g) => g.fineness === n) ?? null };
  }
  const k = String(x).trim().toLowerCase().replace(/[-\s]+/g, '_');
  const key = GRADE_ALIASES[k] ?? k;
  const g = GRADES.find((r) => r.key === key);
  if (!g) throw new InputError(`Unknown silver grade "${x}". Use fine, britannia, sterling, coin, 800 or a fineness number such as 925.`);
  return { fineness: g.fineness, grade: g };
}

// ---------------------------------------------------------------- coins

const LAW_1965 = 'https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg254.pdf';
const USC_5112 = 'https://www.law.cornell.edu/uscode/text/31/5112';

export interface Coin { key: string; name: string; years: string; face: number; gross_grams: number; silver_grams: number; basis: string; source: string; aliases: string[] }

/** As-minted silver content. Worn circulated coins hold slightly less. */
export const COINS: Coin[] = [
  { key: 'dime_90', name: 'US silver dime (Mercury, Roosevelt, Barber)', years: '1964 and earlier', face: 0.10, gross_grams: 2.5, silver_grams: 2.25, basis: '2.5 g at 900 fine', source: 'https://en.wikipedia.org/wiki/Roosevelt_dime (Coinage Act of 1873 standard; 900 fine confirmed in Coinage Act of 1965 sec. 101(b))', aliases: ['dime', 'dimes', 'roosevelt_dime', 'mercury_dime', 'silver_dime'] },
  { key: 'quarter_90', name: 'US silver quarter (Washington, Standing Liberty, Barber)', years: '1964 and earlier', face: 0.25, gross_grams: 6.25, silver_grams: 5.625, basis: '6.25 g at 900 fine', source: 'https://en.wikipedia.org/wiki/Washington_quarter (Coinage Act of 1873 standard; 900 fine confirmed in Coinage Act of 1965 sec. 101(b))', aliases: ['quarter', 'quarters', 'washington_quarter', 'silver_quarter'] },
  { key: 'half_90', name: 'US silver half dollar (Franklin, Walking Liberty, 1964 Kennedy)', years: '1964 and earlier', face: 0.50, gross_grams: 12.5, silver_grams: 11.25, basis: '12.5 g at 900 fine', source: 'https://en.wikipedia.org/wiki/Franklin_half_dollar (Coinage Act of 1873 standard; 900 fine confirmed in Coinage Act of 1965 sec. 101(b))', aliases: ['half', 'half_dollar', 'halves', 'franklin_half', 'walking_liberty_half', '1964_kennedy'] },
  { key: 'kennedy_40', name: 'US Kennedy half dollar, 40% silver clad', years: '1965 to 1970', face: 0.50, gross_grams: 11.5, silver_grams: 4.6, basis: 'Coinage Act of 1965 sec. 101(a)(1): whole coin 11.5 g containing 4.6 g of silver', source: LAW_1965, aliases: ['kennedy_half_40', 'kennedy', 'kennedy_half', '40_percent_half', 'half_40'] },
  { key: 'war_nickel', name: 'US wartime Jefferson nickel, 35% silver', years: '1942 to 1945 (large mint mark over Monticello)', face: 0.05, gross_grams: 5.0, silver_grams: 1.75, basis: '5.000 g at 35% silver', source: 'https://en.wikipedia.org/wiki/Jefferson_nickel', aliases: ['nickel', 'war_nickels', 'jefferson_war_nickel', 'wartime_nickel'] },
  { key: 'dollar_90', name: 'US Morgan or Peace silver dollar', years: '1878 to 1935', face: 1.0, gross_grams: 26.73, silver_grams: 412.5 * 0.9 * GRAIN_G, basis: '412.5 grains at 900 fine = 371.25 grains = 24.0566 g', source: 'https://en.wikipedia.org/wiki/Morgan_dollar and https://en.wikipedia.org/wiki/Peace_dollar', aliases: ['morgan', 'morgan_dollar', 'peace', 'peace_dollar', 'silver_dollar'] },
  { key: 'silver_eagle', name: 'American Silver Eagle bullion coin', years: '1986 to date', face: 1.0, gross_grams: 31.103, silver_grams: TROY_OZ_G, basis: '31 U.S.C. 5112(e): weighs 31.103 g, .999 fine, inscribed "1 Oz. Fine Silver"; valued here at 1 troy ounce of silver', source: USC_5112, aliases: ['eagle', 'ase', 'american_silver_eagle', 'silver_eagles'] },
];

export function resolveCoin(c: string): Coin {
  const k = c.trim().toLowerCase().replace(/[-\s]+/g, '_');
  const hit = COINS.find((x) => x.key === k || x.aliases.includes(k));
  if (!hit) throw new InputError(`Unknown coin "${c}". Use one of: ${COINS.map((x) => x.key).join(', ')}.`);
  return hit;
}

/** Troy ounces of silver per 1 US dollar of face value of 90% coin (dimes, quarters, halves): 1 dollar = 10 dimes = 22.5 g. */
export const OZ_PER_DOLLAR_90 = 22.5 / TROY_OZ_G;

// ---------------------------------------------------------------- arithmetic

export const round = (x: number, d = 2) => { const f = 10 ** d; return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f; };

export function fineRow(perOzFine: number, fineness: number) {
  const perGramFine = perOzFine / TROY_OZ_G;
  const p = fineness / 1000;
  return {
    per_gram: round(perGramFine * p, 4), per_troy_ounce: round(perOzFine * p), per_kilogram: round(perGramFine * p * 1000),
    per_tola: round(perGramFine * p * UNITS.tola.grams),
  };
}

export function meltValue(perOzFine: number, weight: number, unit: string, fineness: number, spreadPct = 0) {
  const u = resolveUnit(unit);
  const grams = weight * UNITS[u].grams;
  const fineGrams = (grams * fineness) / 1000;
  const melt = (fineGrams / TROY_OZ_G) * perOzFine;
  const offer = melt * (1 - spreadPct / 100);
  return { unit: u, grams: round(grams, 6), fine_silver_grams: round(fineGrams, 6), fine_silver_troy_ounces: round(fineGrams / TROY_OZ_G, 6), melt_value: round(melt), dealer_offer: round(offer), spread_amount: round(melt - offer) };
}

export function coinMelt(perOzFine: number, items: { coin: string; count: number }[]) {
  if (!items.length) throw new InputError('Give at least one coin, for example [{"coin":"quarter_90","count":40}].');
  const rows = items.map((it) => {
    if (!(Number.isInteger(it.count) && it.count > 0)) throw new InputError(`Count for ${it.coin} must be a whole number of 1 or more.`);
    const c = resolveCoin(it.coin);
    const silverG = c.silver_grams * it.count;
    const oz = silverG / TROY_OZ_G;
    return {
      coin: c.key, name: c.name, years: c.years, count: it.count, face_value_usd: round(c.face * it.count),
      silver_grams_each: round(c.silver_grams, 4), silver_troy_ounces_each: round(c.silver_grams / TROY_OZ_G, 6),
      silver_troy_ounces: round(oz, 6), melt_value: round(oz * perOzFine), melt_each: round((c.silver_grams / TROY_OZ_G) * perOzFine), basis: c.basis, source: c.source,
    };
  });
  const totOz = rows.reduce((s, r) => s + r.silver_troy_ounces, 0);
  const face = rows.reduce((s, r) => s + r.face_value_usd, 0);
  return { rows, total_silver_troy_ounces: round(totOz, 6), total_face_value_usd: round(face), total_melt_value: round(totOz * perOzFine) };
}

// ---------------------------------------------------------------- upstream parsing

export interface Spot { symbol: string; name: string; usd_per_troy_ounce: number; updated_at: string }

const RANGES: Record<string, [number, number]> = { XAU: [500, 50000], XAG: [3, 2000] };

export function parseSpot(text: string, symbol: string): Spot {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new UpstreamError(`gold-api.com returned non-JSON for ${symbol}`); }
  if (j?.error) throw new UpstreamError(`gold-api.com error for ${symbol}: ${j.error}`);
  const p = Number(j?.price);
  const [lo, hi] = RANGES[symbol] ?? [0, Infinity];
  if (j?.symbol !== symbol || !Number.isFinite(p) || p < lo || p > hi) throw new UpstreamError(`gold-api.com returned an implausible ${symbol} price (${j?.price})`);
  if (j?.currency && j.currency !== 'USD') throw new UpstreamError(`gold-api.com returned ${j.currency}, expected USD`);
  return { symbol, name: String(j.name ?? symbol), usd_per_troy_ounce: p, updated_at: String(j.updatedAt ?? '') };
}

export interface Fx { date: string; rates: Record<string, number>; dates: Record<string, string> }

export function parseFx(text: string): Fx {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new UpstreamError('Frankfurter returned non-JSON'); }
  if (!Array.isArray(j) || j.length < 20) throw new UpstreamError('Frankfurter returned an unexpected rates payload');
  const rates: Record<string, number> = { USD: 1 };
  const dates: Record<string, string> = {};
  let date = '';
  for (const r of j) {
    if (r?.base !== 'USD' || typeof r.quote !== 'string' || !(Number(r.rate) > 0)) continue;
    rates[r.quote] = Number(r.rate);
    dates[r.quote] = String(r.date ?? '');
    if (r.date > date) date = r.date;
  }
  if (!rates.EUR) throw new UpstreamError('Frankfurter payload has no EUR rate');
  return { date, rates, dates };
}

// ---------------------------------------------------------------- fetches

const upstream = async (fetchText: FetchText, url: string, ttl: number, who: string) => {
  try { return await fetchText(url, { cacheTtl: ttl, timeoutMs: 10000 }); } catch (e) {
    throw new UpstreamError(`${who} is not answering right now (${(e as Error).message}). Try again in a few minutes. Do not quote a silver price from memory.`);
  }
};

export async function fetchSpot(fetchText: FetchText, symbol: string): Promise<Spot> {
  return parseSpot(await upstream(fetchText, `${SPOT_API}/${symbol}`, SPOT_TTL, 'gold-api.com'), symbol);
}

export async function fetchFx(fetchText: FetchText, currency: string): Promise<{ rate: number; date: string | null }> {
  if (currency === 'USD') return { rate: 1, date: null };
  const fx = parseFx(await upstream(fetchText, FX_API, FX_TTL, 'Frankfurter (central bank FX)'));
  const rate = fx.rates[currency];
  if (!rate) throw new InputError(`Currency "${currency}" is not in the central-bank FX set. Use an ISO 4217 code such as USD, EUR, GBP, INR, CAD, AUD, MXN. Available: ${Object.keys(fx.rates).sort().join(', ')}.`);
  return { rate, date: fx.dates[currency] || fx.date };
}

export function checkCurrency(c: string): string {
  const s = c.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) throw new InputError(`Currency must be a 3-letter ISO 4217 code such as USD, EUR, GBP or INR. Got "${c}".`);
  return s;
}

const SOURCE_SPOT = 'https://gold-api.com/';
const fmt = (x: number, cur: string, d = 2) => `${x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })} ${cur}`;
const MELT_NOTE = 'Melt (spot) value only. Dealers sell bullion and coins above spot (premium) and buy below it; numismatic coins can be worth far more than melt.';

// ---------------------------------------------------------------- tool cores

export async function getSilverPricePerGram(fetchText: FetchText, currencyIn = 'USD', finenessIn?: string | number) {
  const currency = checkCurrency(currencyIn);
  const pick = finenessIn === undefined ? null : resolveFineness(finenessIn);
  const [spot, fx] = await Promise.all([fetchSpot(fetchText, 'XAG'), fetchFx(fetchText, currency)]);
  const perOz = spot.usd_per_troy_ounce * fx.rate;
  const grades = pick
    ? [{ fineness: pick.fineness, name: pick.grade?.name ?? `${pick.fineness}/1000 silver`, rule: pick.grade?.rule ?? 'custom fineness', ...fineRow(perOz, pick.fineness) }]
    : GRADES.map((g) => ({ fineness: g.fineness, name: g.name, rule: g.rule, ...fineRow(perOz, g.fineness) }));
  const lead = grades[0];
  const summary = `${lead.name} is ${fmt(lead.per_gram, currency, 4)} per gram (${fmt(lead.per_troy_ounce, currency)} per troy ounce, ${fmt(lead.per_kilogram, currency)} per kilogram) at a silver spot of ${fmt(perOz, currency)} per troy ounce of pure silver, as of ${spot.updated_at}` +
    (grades.length > 1 ? `. Per gram by grade: ${grades.slice(1).map((r) => `${r.fineness} ${fmt(r.per_gram, currency, 4)}`).join(', ')}.` : '.') + ` ${MELT_NOTE}`;
  return {
    currency, spot_per_troy_ounce: round(perOz), spot_per_gram: round(perOz / TROY_OZ_G, 4), spot_usd_per_troy_ounce: spot.usd_per_troy_ounce, usd_to_currency: fx.rate,
    grades, fineness_rule: 'price per gram = spot per troy ounce / 31.1034768 x fineness / 1000',
    as_of: spot.updated_at, fx_date: fx.date,
    source: SOURCE_SPOT, sources: { spot: `${SPOT_API}/XAG`, fx: currency === 'USD' ? null : FX_API, fineness: [CFR_23_5, UK_HALLMARK], units: NIST_HB44 },
    more: PAGE_SILVER, summary,
  };
}

export async function calculateSilverValue(fetchText: FetchText, a: { weight: number; unit?: string; fineness?: string | number; currency?: string; dealer_spread_percent?: number }) {
  const currency = checkCurrency(a.currency ?? 'USD');
  const f = resolveFineness(a.fineness ?? 'sterling');
  if (!(a.weight > 0) || !Number.isFinite(a.weight)) throw new InputError('Weight must be a positive number.');
  const spread = a.dealer_spread_percent ?? 0;
  if (!(spread >= 0 && spread < 100)) throw new InputError('dealer_spread_percent must be from 0 to below 100.');
  const unit = resolveUnit(a.unit ?? 'gram');
  const [spot, fx] = await Promise.all([fetchSpot(fetchText, 'XAG'), fetchFx(fetchText, currency)]);
  const perOz = spot.usd_per_troy_ounce * fx.rate;
  const v = meltValue(perOz, a.weight, unit, f.fineness, spread);
  const summary = `${a.weight} ${UNITS[unit].label} of ${f.grade?.name ?? `${f.fineness}/1000 silver`} holds ${v.fine_silver_grams} g (${v.fine_silver_troy_ounces} troy oz) of pure silver, a melt value of ${fmt(v.melt_value, currency)} at a spot of ${fmt(perOz, currency)} per troy ounce (as of ${spot.updated_at}).` +
    (spread > 0 ? ` With a ${spread}% dealer spread, a buyer would offer about ${fmt(v.dealer_offer, currency)}.` : '') + ` ${MELT_NOTE}`;
  return {
    input: { weight: a.weight, unit, fineness: f.fineness, currency, dealer_spread_percent: spread },
    ...v, spot_per_troy_ounce: round(perOz), usd_to_currency: fx.rate,
    note: 'melt_value = weight in grams x fineness/1000 / 31.1034768 x spot per troy ounce. dealer_offer = melt_value x (1 - spread/100).',
    as_of: spot.updated_at, fx_date: fx.date, source: SOURCE_SPOT, sources: { spot: `${SPOT_API}/XAG`, fx: currency === 'USD' ? null : FX_API, fineness: f.grade?.source ?? CFR_23_5, units: NIST_HB44 },
    more: f.fineness === 925 ? PAGE_STERLING : PAGE_SILVER, related: [PAGE_SILVER], summary,
  };
}

export async function calculateJunkSilverValue(fetchText: FetchText, a: { coins?: { coin: string; count: number }[]; face_value_90?: number; currency?: string; dealer_spread_percent?: number }) {
  const currency = checkCurrency(a.currency ?? 'USD');
  const spread = a.dealer_spread_percent ?? 0;
  if (!(spread >= 0 && spread < 100)) throw new InputError('dealer_spread_percent must be from 0 to below 100.');
  const items = [...(a.coins ?? [])];
  let faceOnly = 0;
  if (a.face_value_90 !== undefined) {
    if (!(a.face_value_90 > 0) || Math.round(a.face_value_90 * 100) % 10 !== 0) throw new InputError('face_value_90 must be a positive dollar amount in multiples of 0.10 (for example 10 for ten dollars face of 90% dimes, quarters and halves).');
    faceOnly = a.face_value_90;
  }
  if (!items.length && !faceOnly) throw new InputError('Give coins (for example [{"coin":"quarter_90","count":40}]) or face_value_90 (dollars face of pre-1965 dimes, quarters and halves).');
  const [spot, fx] = await Promise.all([fetchSpot(fetchText, 'XAG'), fetchFx(fetchText, currency)]);
  const perOz = spot.usd_per_troy_ounce * fx.rate;
  const m = items.length ? coinMelt(perOz, items) : { rows: [], total_silver_troy_ounces: 0, total_face_value_usd: 0, total_melt_value: 0 };
  const faceOz = faceOnly * OZ_PER_DOLLAR_90;
  const totOz = m.total_silver_troy_ounces + faceOz;
  const melt = totOz * perOz;
  const offer = melt * (1 - spread / 100);
  const perDollar90 = OZ_PER_DOLLAR_90 * perOz;
  const summary = `${[...m.rows.map((r) => `${r.count} x ${r.coin}`), ...(faceOnly ? [`${faceOnly} USD face of 90% coin`] : [])].join(', ')} contain ${round(totOz, 4)} troy oz of silver, a melt value of ${fmt(melt, currency)} at a spot of ${fmt(perOz, currency)} per troy ounce (as of ${spot.updated_at}).` +
    ` One dollar face of pre-1965 90% dimes, quarters or halves holds ${round(OZ_PER_DOLLAR_90, 6)} troy oz (22.5 g), worth ${fmt(perDollar90, currency)} now; dealers often quote 0.715 oz per dollar for worn coins.` +
    (spread > 0 ? ` With a ${spread}% dealer spread, a buyer would offer about ${fmt(offer, currency)}.` : '') + ' As-minted silver content; worn coins hold slightly less.';
  return {
    currency, coins: m.rows, face_value_90_usd: faceOnly || null, face_value_90_troy_ounces: faceOnly ? round(faceOz, 6) : null,
    total_silver_troy_ounces: round(totOz, 6), total_silver_grams: round(totOz * TROY_OZ_G, 4), total_face_value_usd: round(m.total_face_value_usd + faceOnly),
    melt_value: round(melt), dealer_offer: round(offer), dealer_spread_percent: spread,
    melt_per_dollar_face_90: round(perDollar90), troy_ounces_per_dollar_face_90: round(OZ_PER_DOLLAR_90, 6),
    spot_per_troy_ounce: round(perOz), usd_to_currency: fx.rate,
    as_of: spot.updated_at, fx_date: fx.date, source: SOURCE_SPOT, sources: { spot: `${SPOT_API}/XAG`, fx: currency === 'USD' ? null : FX_API, coinage_act_1965: LAW_1965, silver_eagle: USC_5112 },
    more: PAGE_JUNK, related: [PAGE_EAGLE], summary,
  };
}

export async function getGoldSilverRatio(fetchText: FetchText, currencyIn = 'USD') {
  const currency = checkCurrency(currencyIn);
  const [ag, au, fx] = await Promise.all([fetchSpot(fetchText, 'XAG'), fetchSpot(fetchText, 'XAU'), fetchFx(fetchText, currency)]);
  const ratio = au.usd_per_troy_ounce / ag.usd_per_troy_ounce;
  const agOz = ag.usd_per_troy_ounce * fx.rate;
  const auOz = au.usd_per_troy_ounce * fx.rate;
  const summary = `The gold to silver ratio is ${round(ratio, 2)}: one troy ounce of gold (${fmt(auOz, currency)}) buys ${round(ratio, 2)} troy ounces of silver (${fmt(agOz, currency)} each), as of ${ag.updated_at > au.updated_at ? ag.updated_at : au.updated_at}. Silver is ${fmt(agOz / TROY_OZ_G, currency, 4)} per gram and gold ${fmt(auOz / TROY_OZ_G, currency)} per gram.`;
  return {
    currency, gold_silver_ratio: round(ratio, 4),
    silver: { per_troy_ounce: round(agOz), per_gram: round(agOz / TROY_OZ_G, 4), updated_at: ag.updated_at },
    gold: { per_troy_ounce: round(auOz), per_gram: round(auOz / TROY_OZ_G, 4), updated_at: au.updated_at },
    note: 'ratio = gold USD per troy ounce / silver USD per troy ounce; it does not depend on currency.',
    as_of: ag.updated_at, fx_date: fx.date, source: SOURCE_SPOT, sources: { silver: `${SPOT_API}/XAG`, gold: `${SPOT_API}/XAU`, fx: currency === 'USD' ? null : FX_API },
    more: PAGE_SILVER, related: [link('/')], summary,
  };
}
