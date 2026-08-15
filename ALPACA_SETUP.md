# Alpaca API setup for Broad ETF Assistant

## Important: do not put your Alpaca secret in this GitHub Pages repository

This site is public and runs in the browser. Any API key or secret placed in `index.html`, JavaScript files, GitHub Pages configuration, or a committed `.env` file can be exposed to visitors.

Use Alpaca through a small serverless/backend proxy. Keep `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY` as encrypted environment secrets on the backend host.

## Recommended architecture

Browser (GitHub Pages)
→ your `/api/market-data` serverless endpoint
→ Alpaca Market Data API

The backend adds these headers when calling Alpaca:

- `APCA-API-KEY-ID`
- `APCA-API-SECRET-KEY`

The browser never receives either credential.

## Where to add the credentials

Add them in the Environment Variables / Secrets section of the serverless host you choose (for example Cloudflare Workers, Vercel Functions, Netlify Functions, AWS Lambda, or a small Render service):

- `APCA_API_KEY_ID` = your Alpaca API key ID
- `APCA_API_SECRET_KEY` = your Alpaca secret key

Do NOT add the values to this repository.

## Important coverage limitation

Alpaca's documented equities Market Data API is for US equities. The current core portfolio uses London-listed UCITS tickers such as CSPX, EIMI and WSML, so Alpaca should not be assumed to provide those LSE listings. Before replacing the existing feed, test symbol coverage. Alpaca can still be useful for US-listed broad ETF proxies/benchmarks and other supported US equities.

## Proposed V15 data adapter

The dashboard should call one internal endpoint such as:

`/api/market-data?symbol=SPY&start=2025-01-01&timeframe=1Day`

The serverless function calls Alpaca's historical bars endpoint and returns only normalized data needed by the dashboard:

```json
{
  "symbol": "SPY",
  "source": "alpaca",
  "bars": [
    {"date":"2026-08-14","close":0}
  ]
}
```

For CSPX/EIMI/WSML, retain a provider that explicitly supports London-listed UCITS ETFs unless Alpaca confirms those symbols are available.

## Security rules

1. Never commit the Alpaca secret.
2. Never expose it in browser JavaScript.
3. Never save it in localStorage.
4. Restrict the backend endpoint to the symbols/timeframes the ETF Assistant needs.
5. Add caching and rate limiting.
6. Use market-data access only; do not add trading/order endpoints to this educational tool.
