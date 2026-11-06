# Week 5: Market Statistics Agent

The `market-statistics` OpenClaw skill answers city-level California housing
market questions from `california_sold` and compares sold volume with active
inventory in `rets_property`.

## Metrics

- Average and median close price
- Average price per square foot
- Average days on market
- List-to-close price ratio
- Residential sold count and active inventory
- Monthly price, DOM, sales, MoM, and YoY trends

The imported `CloseDate` column is text and includes invalid future dates. All
queries parse it with `STR_TO_DATE`, reject dates after `CURDATE()`, require
`PropertyType = 'Residential'`, and bind user values through `?` parameters.

## Commands

```bash
npm test
npm run test:market-db
node skills/market-statistics/scripts/analyze-market.mjs --city Irvine --months 12
```

## OpenClaw registration

```bash
openclaw skills install ./skills/market-statistics --force
openclaw skills info market-statistics
```

Invoke in OpenClaw with:

```text
/market-statistics What is the housing market like in Irvine?
```

The output is descriptive historical data and must not be presented as
personalized financial advice.
