# Broad ETF Investment Assistant — V16.8

A decision-support dashboard for broad-based UCITS ETF investing, designed around a monthly AED contribution and a core allocation of 65% CSPX / 20% EIMI / 15% WSML.

## Current production architecture

- Broad-based ETF universe only; no individual-stock recommendations.
- Monthly contribution and portfolio-drift engine with allocation conservation checks.
- Recommendation validation gate: market-timing signals are not treated as recommendation-grade without sufficient validated history.
- Daily market-history cache generated server-side and served from the same GitHub Pages origin.
- CSPX, EIMI and WSML cache updater validates at least 250 closes, increasing dates, positive prices, freshness and extreme jumps.
- Browser refresh states: FRESH CACHE, CACHED, STALE, CACHED LOCAL and UNAVAILABLE.
- Last validated local history is preserved if the repository cache is temporarily unavailable.
- Manual validated history intake remains available as a fallback.
- Playwright regression tests cover desktop Chromium and mobile WebKit paths.
- GitHub Actions runs automated QA and a scheduled weekday market-cache refresh.

## Market data

`scripts/update-market-data.mjs` retrieves delayed daily history outside the browser, validates it, and writes `data/market-history.json`. `.github/workflows/market-data.yml` runs the refresh on weekdays and can also be dispatched manually.

The web app does not depend on direct browser access to LSEG/Yahoo endpoints for its primary refresh path. This avoids CORS/403 failures becoming user-facing recommendation data failures.

Market data is delayed and provided for educational decision support. A successful cache load does not mean the data is real-time.

## QA

Run locally:

```bash
npm install
npx playwright install --with-deps
npm test
```

The automated suite checks core navigation, System Check, monthly decision generation, portfolio persistence, research tools, ETF comparison, history validation, allocation conservation, same-origin market-cache loading, cache-failure fallback, IBKR JSON import, monthly review controls and browser errors.

## Deployment

The application is static and GitHub Pages compatible. `main` is the production branch. Changes should be considered release-ready only after automated QA succeeds and the market-data state is explicit rather than silently assumed.

## Important

This is an educational decision-support tool, not regulated investment advice. Broad-market ETFs can lose value. Backtests, projections, valuation signals, drawdowns and risk measures are illustrative and do not guarantee future returns. No automatic trading is performed.
