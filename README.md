# silver-price-per-gram-mcp

The live silver price per gram for AI assistants, by fineness and currency, with sterling melt value, US junk silver coin value and the gold to silver ratio.

This is a Model Context Protocol (MCP) server. It reads the silver spot price at call time and converts it with central-bank FX rates for about 160 currencies. It needs no API key.

## Tools

| Tool | What it returns |
| --- | --- |
| `get_silver_price_per_gram` | Silver price per gram, troy ounce, kilogram and tola for fine .999, Britannia .9584, sterling .925, coin .900 and 800 silver in any currency, with the spot time stamp and FX date. |
| `calculate_silver_value` | Melt value of a silver item (sterling flatware, jewellery, bars, scrap) from weight, unit and fineness, with an optional dealer spread percent. |
| `calculate_junk_silver_value` | Melt value of US 90% dimes, quarters and halves, 40% Kennedy halves, 35% war nickels, Morgan and Peace dollars and American Silver Eagles, by coin count or by dollars of face value. |
| `get_gold_silver_ratio` | Live gold to silver ratio, with both spot prices per troy ounce and per gram in any currency. |

Every result has structured JSON, a one-paragraph summary, `as_of`, `source` and `more` (the matching page on [goldgramprice.com](https://goldgramprice.com/silver-price-per-gram/?utm_source=mcp&utm_medium=silver-price-per-gram-mcp)).

## What it knows that your model does not

- Today's silver price. Spot moves every minute and a model's training data is months old.
- Today's exchange rate for EUR, GBP, INR, CAD, MXN and about 150 more currencies.
- Exact coin silver content from statute. A 1965 to 1970 Kennedy half holds 4.6 g of silver (Coinage Act of 1965), not the 90% of earlier halves. One dollar face of pre-1965 dimes, quarters or halves holds 22.5 g, which is 0.723392 troy ounces.
- What the words mean. "Sterling" needs at least 925 parts per thousand of silver and "coin silver" at least 900 (16 CFR 23.5). Britannia silver is 958.4 (UK Hallmarking Act 1973).
- Exact units. A troy ounce is 31.1034768 g (NIST Handbook 44). A kitchen-scale ounce is 28.349523125 g. Mixing them up is a 9.7% error.

## Install

### Hosted (Claude.ai custom connector, ChatGPT developer mode)

Paste this URL. No token, no sign-up.

```
https://silver-price-per-gram-mcp.lipmichal.workers.dev/mcp
```

### Claude Code

```
claude mcp add --transport http silver-price https://silver-price-per-gram-mcp.lipmichal.workers.dev/mcp
```

Or run it locally over stdio:

```
claude mcp add silver-price -- npx -y github:theluckystrike/silver-price-per-gram-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "silver-price": { "command": "npx", "args": ["-y", "github:theluckystrike/silver-price-per-gram-mcp"] }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "silver-price": { "url": "https://silver-price-per-gram-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "silver-price": { "type": "http", "url": "https://silver-price-per-gram-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

Node 20 or newer is needed for the local stdio version.

## Example prompts

- "What is the silver price per gram today?"
- "What is 925 sterling silver worth per gram in pounds?"
- "I have a sterling tea set that weighs 1.8 kg. What is the melt value, and what might a buyer offer at a 20% spread?"
- "How much is 40 pre-1965 quarters and 3 Morgan dollars worth in silver?"
- "What is the gold to silver ratio right now?"

## Data sources

Full list with fetch dates in [DATA_SOURCES.md](DATA_SOURCES.md).

- Spot prices from [gold-api.com](https://gold-api.com/), the same feed goldgramprice.com uses. Its terms allow commercial use and ask callers not to send several requests per second, so the hosted server caches each price for 5 minutes.
- FX rates from [Frankfurter](https://frankfurter.dev/), blended from the ECB and other central banks. Cached for 1 hour. Rates update once a working day.
- Fineness rules from 16 CFR 23.5 and the UK Hallmarking Act 1973 Schedule 2. Coin content from the Coinage Act of 1965 and 31 U.S.C. 5112(e). Unit constants from NIST Handbook 44.

## Limitations

- Prices are spot (melt) values. Dealers sell coins and bars above spot and buy below it. Rare or graded coins can be worth far more than melt. The tools say so in every answer.
- Coin silver content is the as-minted amount. Worn circulated coins hold slightly less; dealers often use 0.715 troy ounces per dollar face for worn 90% coin.
- The spot price can be up to 5 minutes old on the hosted server. FX rates are daily reference rates, not live market quotes.
- When a price feed is down, the tool returns a clear error instead of a stale or remembered number.

## More

Silver price per gram, junk silver melt value, gold karat calculators and gold price history are on [goldgramprice.com](https://goldgramprice.com/silver-price-per-gram/?utm_source=mcp&utm_medium=silver-price-per-gram-mcp).

Part of the Zovo MCP collection: https://mcp.zovo.one

## Development

```
npm install
npm test            # builds, then runs the fixture tests against saved upstream payloads
node scripts/smoke-stdio.mjs   # live stdio check, one real call per tool
npx wrangler deploy            # Cloudflare Worker, Streamable HTTP at /mcp
```

## License

MIT
