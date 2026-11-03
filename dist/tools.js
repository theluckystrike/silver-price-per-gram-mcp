// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { COINS, InputError, REPO, SITE, UNIT_NAMES, calculateJunkSilverValue, calculateSilverValue, getGoldSilverRatio, getSilverPricePerGram, } from './core.js';
export const VERSION = '1.0.0';
export const TOOL_INFO = [
    { name: 'get_silver_price_per_gram', blurb: 'Live silver price per gram, troy ounce, kilogram and tola for fine .999, Britannia .9584, sterling .925, coin .900 and 800 silver in 160+ currencies.' },
    { name: 'calculate_silver_value', blurb: 'Melt value of a silver item (sterling flatware, jewellery, bars) from weight, unit and fineness, with an optional dealer spread.' },
    { name: 'calculate_junk_silver_value', blurb: 'Melt value of US 90% and 40% silver coins, war nickels, Morgan and Peace dollars and Silver Eagles by count or by face value.' },
    { name: 'get_gold_silver_ratio', blurb: 'Live gold to silver ratio with both spot prices per troy ounce and per gram in any currency.' },
];
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
function ok(data) {
    return { content: [{ type: 'text', text: `${data.summary}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data };
}
function fail(e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { isError: true, content: [{ type: 'text', text: `${e instanceof InputError ? 'Error' : 'Upstream price feed error'}: ${msg}` }] };
}
const currency = z.string().min(3).max(3).default('USD').describe('ISO 4217 currency code, for example USD, EUR, GBP, INR, CAD, AUD, MXN. Default USD.');
const fineness = z.union([z.number().positive().max(1000), z.string().min(1).max(20)])
    .describe('Silver grade: "fine" (999), "britannia" (958.4), "sterling" (925), "coin" (900), "800", or parts per thousand such as 925, or a fraction such as 0.925.');
const unit = z.string().min(1).max(30).describe(`Weight unit: ${UNIT_NAMES.join(', ')}. Aliases such as g, kg, oz, ozt, dwt, lb work. "oz" means troy ounce; use avoirdupois_ounce for a kitchen scale.`);
const spread = z.number().min(0).max(99).optional().describe('Percent a buyer keeps below melt, for example 15 for an offer at 85% of melt. Default 0.');
export function createServer(fetchText) {
    const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE }, {
        instructions: 'Live silver spot price (gold-api.com, refreshed every few minutes) converted with central-bank FX rates (Frankfurter), plus US coin silver content from statute. ' +
            'Silver prices change every minute; never answer a current silver price from memory. Values are melt (spot) values: dealers sell above them and buy below them.',
    });
    server.registerTool('get_silver_price_per_gram', {
        title: 'Get silver price per gram',
        description: 'Today\'s silver price per gram, per troy ounce, per kilogram and per tola, read live from the silver spot market, for fine .999, Britannia .9584, sterling .925, coin .900 and 800 silver, in any of about 160 currencies (central-bank FX). ' +
            'Returns the spot time stamp, FX date and sources. Your training data cannot know today\'s silver price. Omit fineness to get every grade.',
        inputSchema: { currency, fineness: fineness.optional() },
        annotations: { title: 'Silver price per gram', ...RO },
    }, async ({ currency: c, fineness: f }) => {
        try {
            return ok(await getSilverPricePerGram(fetchText, c ?? 'USD', f));
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('calculate_silver_value', {
        title: 'Calculate silver melt value',
        description: 'Melt value of a silver item (sterling flatware, tea set, jewellery, bar, round, scrap) from its weight, unit and fineness at the live silver spot price, in any currency. ' +
            'Optional dealer_spread_percent returns the likely buyer offer. Sterling means at least 925/1000 silver under 16 CFR 23.5. Default fineness is sterling.',
        inputSchema: {
            weight: z.number().positive().max(1e7).describe('Weight of the item, for example 250.'),
            unit: unit.default('gram'),
            fineness: fineness.default('sterling'),
            currency,
            dealer_spread_percent: spread,
        },
        annotations: { title: 'Silver melt value', ...RO },
    }, async (a) => {
        try {
            return ok(await calculateSilverValue(fetchText, a));
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('calculate_junk_silver_value', {
        title: 'Calculate junk silver coin value',
        description: 'Melt value of US silver coins at the live silver spot: pre-1965 90% dimes, quarters and halves, 1965-1970 40% Kennedy halves (4.6 g silver, Coinage Act of 1965), 1942-1945 35% war nickels, Morgan and Peace dollars and American Silver Eagles. ' +
            'Pass coins with counts, or face_value_90 for a bag of mixed 90% coin (1 dollar face = 22.5 g silver). Returns silver ounces per coin, totals and melt per dollar face.',
        inputSchema: {
            coins: z.array(z.object({
                coin: z.string().min(2).max(40).describe(`Coin key: ${COINS.map((c) => c.key).join(', ')}. Aliases such as dime, quarter, half, kennedy, morgan, eagle work.`),
                count: z.number().int().min(1).max(1e7).describe('Number of coins.'),
            })).max(20).optional().describe('Coins and counts, for example [{"coin":"quarter_90","count":40},{"coin":"morgan","count":3}].'),
            face_value_90: z.number().positive().max(1e7).optional().describe('Dollars of face value in mixed pre-1965 90% dimes, quarters and halves, for example 10.'),
            currency,
            dealer_spread_percent: spread,
        },
        annotations: { title: 'Junk silver value', ...RO },
    }, async (a) => {
        try {
            return ok(await calculateJunkSilverValue(fetchText, a));
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('get_gold_silver_ratio', {
        title: 'Get gold to silver ratio',
        description: 'Live gold to silver ratio (ounces of silver one ounce of gold buys), with both spot prices per troy ounce and per gram in any currency. Read now from the spot feed; the ratio moves every minute.',
        inputSchema: { currency },
        annotations: { title: 'Gold silver ratio', ...RO },
    }, async ({ currency: c }) => {
        try {
            return ok(await getGoldSilverRatio(fetchText, c ?? 'USD'));
        }
        catch (e) {
            return fail(e);
        }
    });
    return server;
}
