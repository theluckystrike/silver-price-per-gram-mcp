// Fixtures: statutory coin silver content, fineness rules, unit constants, and parsing of saved upstream payloads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNITS, TROY_OZ_G, OZ_PER_DOLLAR_90, COINS, resolveCoin, resolveFineness, resolveUnit, fineRow, meltValue, coinMelt, parseSpot, parseFx, round,
  getSilverPricePerGram, calculateSilverValue, calculateJunkSilverValue, getGoldSilverRatio, InputError, UpstreamError, UTM,
} from '../dist/core.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const fake = (overrides = {}) => async (url) => {
  if (url in overrides) { const v = overrides[url]; if (v instanceof Error) throw v; return v; }
  const m = url.match(/price\/(X\w\w)$/);
  if (m) return fx(`gold-api-${m[1]}-2026-11-03.json`);
  if (url.includes('frankfurter')) return fx('frankfurter-v2-usd-2026-11-03.json');
  throw new Error('unexpected url ' + url);
};
const coin = (k) => COINS.find((c) => c.key === k);

test('troy ounce is exactly 31.1034768 g and troy pound 12 oz', () => { close(TROY_OZ_G, 31.1034768, 1e-12); close(UNITS.troy_pound.grams, 373.2417216, 1e-9); });
test('90% dime 2.25 g, quarter 5.625 g, half 11.25 g of silver (2.5/6.25/12.5 g at 900 fine)', () => {
  assert.equal(coin('dime_90').silver_grams, 2.25); assert.equal(coin('quarter_90').silver_grams, 5.625); assert.equal(coin('half_90').silver_grams, 11.25);
  close(coin('quarter_90').silver_grams / TROY_OZ_G, 0.180847, 1e-6);
});
test('1965-1970 Kennedy half holds 4.6 g silver (Coinage Act of 1965 sec. 101(a)(1)) = 0.147893 ozt', () => close(round(coin('kennedy_40').silver_grams / TROY_OZ_G, 6), 0.147893, 1e-12));
test('war nickel 35% of 5 g = 1.75 g = 0.056264 ozt', () => close(round(coin('war_nickel').silver_grams / TROY_OZ_G, 6), 0.056264, 1e-12));
test('Morgan dollar 371.25 grains = 24.0566 g = 0.773438 ozt', () => { close(round(coin('dollar_90').silver_grams, 4), 24.0566, 1e-12); close(round(coin('dollar_90').silver_grams / TROY_OZ_G, 6), 0.773438, 1e-12); });
test('1 dollar face of 90% coin = 22.5 g = 0.723392 ozt, same for 10 dimes, 4 quarters, 2 halves', () => {
  close(round(OZ_PER_DOLLAR_90, 6), 0.723392, 1e-12);
  close(10 * coin('dime_90').silver_grams, 22.5); close(4 * coin('quarter_90').silver_grams, 22.5); close(2 * coin('half_90').silver_grams, 22.5);
});
test('American Silver Eagle valued at 1 troy ounce (31 USC 5112(e))', () => close(coin('silver_eagle').silver_grams, TROY_OZ_G, 1e-12));
test('coin aliases resolve and unknown coin errors', () => {
  assert.equal(resolveCoin('Morgan').key, 'dollar_90'); assert.equal(resolveCoin('kennedy').key, 'kennedy_40'); assert.equal(resolveCoin('quarter').key, 'quarter_90');
  assert.throws(() => resolveCoin('penny'), InputError);
});
test('fineness: sterling 925, coin 900, britannia 958.4, fraction and number forms', () => {
  assert.equal(resolveFineness('sterling').fineness, 925); assert.equal(resolveFineness('coin').fineness, 900); assert.equal(resolveFineness('britannia').fineness, 958.4);
  assert.equal(resolveFineness(0.925).fineness, 925); assert.equal(resolveFineness('999').fineness, 999); assert.equal(resolveFineness(800).grade.key, '800');
  assert.throws(() => resolveFineness('electrum'), InputError); assert.throws(() => resolveFineness(1200), InputError);
});
test('fine row at a spot of 31.1034768 gives 1.0000 per gram fine, 0.925 sterling', () => {
  assert.equal(fineRow(31.1034768, 1000).per_gram, 1); assert.equal(fineRow(31.1034768, 925).per_gram, 0.925); assert.equal(fineRow(31.1034768, 1000).per_kilogram, 1000);
});
test('melt value: 500 g sterling at 50/ozt = 743.49, 15% spread offer 631.96', () => {
  const v = meltValue(50, 500, 'gram', 925, 15);
  close(v.fine_silver_grams, 462.5); assert.equal(v.melt_value, 743.49); assert.equal(v.dealer_offer, 631.96);
});
test('coin melt: 40 quarters + 2 Morgans at 50/ozt', () => {
  const m = coinMelt(50, [{ coin: 'quarter_90', count: 40 }, { coin: 'morgan', count: 2 }]);
  assert.equal(m.total_face_value_usd, 12); close(m.total_silver_troy_ounces, round(225 / TROY_OZ_G + 2 * 371.25 * 0.06479891 / TROY_OZ_G, 6), 2e-6);
  assert.equal(m.rows[0].melt_value, round(225 / TROY_OZ_G * 50));
  assert.throws(() => coinMelt(50, [{ coin: 'dime', count: 0 }]), InputError);
});
test('parse saved gold-api.com payloads', () => {
  const s = parseSpot(fx('gold-api-XAG-2026-11-03.json'), 'XAG'); assert.equal(s.usd_per_troy_ounce, 49.301998); assert.equal(s.updated_at, '2026-11-03T07:30:55Z');
  assert.equal(parseSpot(fx('gold-api-XAU-2026-11-03.json'), 'XAU').usd_per_troy_ounce, 3913.199951);
  assert.throws(() => parseSpot(fx('gold-api-error.json'), 'XAG'), UpstreamError);
  assert.throws(() => parseSpot(fx('gold-api-XAU-2026-11-03.json'), 'XAG'), UpstreamError);
  assert.throws(() => parseSpot('<html>', 'XAG'), UpstreamError);
});
test('parse saved Frankfurter payload', () => { const r = parseFx(fx('frankfurter-v2-usd-2026-11-03.json')); assert.equal(r.rates.USD, 1); assert.ok(r.rates.EUR > 0.5 && r.rates.EUR < 1.5); });
test('get_silver_price_per_gram from saved payloads: fine 999 per gram = 49.301998/31.1034768*0.999', async () => {
  const r = await getSilverPricePerGram(fake(), 'usd');
  assert.equal(r.grades.length, 5); assert.equal(r.grades[0].per_gram, round(49.301998 / TROY_OZ_G * 0.999, 4)); assert.equal(r.spot_per_gram, 1.5851);
  assert.ok(r.more.includes(UTM) && r.more.includes('/silver-price-per-gram/')); assert.equal(r.as_of, '2026-11-03T07:30:55Z');
});
test('calculate_silver_value default fineness is sterling', async () => {
  const r = await calculateSilverValue(fake(), { weight: 1, unit: 'troy_ounce' });
  assert.equal(r.input.fineness, 925); assert.equal(r.melt_value, round(49.301998 * 0.925));
});
test('calculate_junk_silver_value with face value: 10 USD face = 7.23392 ozt', async () => {
  const r = await calculateJunkSilverValue(fake(), { face_value_90: 10 });
  close(r.total_silver_troy_ounces, round(10 * OZ_PER_DOLLAR_90, 6), 1e-6); assert.equal(r.melt_value, round(10 * OZ_PER_DOLLAR_90 * 49.301998));
  await assert.rejects(calculateJunkSilverValue(fake(), { face_value_90: 1.05 }), InputError);
  await assert.rejects(calculateJunkSilverValue(fake(), {}), InputError);
});
test('gold silver ratio = 3913.199951 / 49.301998 = 79.3720', async () => {
  const r = await getGoldSilverRatio(fake(), 'EUR'); assert.equal(r.gold_silver_ratio, round(3913.199951 / 49.301998, 4)); close(r.gold_silver_ratio, 79.372, 1e-4);
});
test('upstream down gives UpstreamError, not a price', async () => {
  await assert.rejects(getSilverPricePerGram(fake({ 'https://api.gold-api.com/price/XAG': new Error('HTTP 503') }), 'USD'), (e) => e instanceof UpstreamError && /Do not quote/.test(e.message));
  await assert.rejects(getSilverPricePerGram(fake(), 'XYZ'), InputError);
});
test('units and aliases', () => { assert.equal(resolveUnit('oz'), 'troy_ounce'); assert.equal(resolveUnit('lb'), 'pound'); assert.throws(() => resolveUnit('stone'), InputError); });
