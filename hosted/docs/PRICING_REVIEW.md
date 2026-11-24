# Pricing review — 2026-11-25

## Decision
- Free local core: $0, MIT, no account required
- Pro sandbox list price: $3.99/month for 20,000 hosted API calls
- Team sandbox list price: $8.99/month for 200,000 hosted API calls
- Live billing: disabled pending separate approval and demand evidence
- Annual plan: not offered initially to avoid premature discounting and billing complexity

## Current external reference points
- Paddle standard Checkout fee: 5% + $0.50 per transaction
- A current Bubble JSON Schema Validator plugin lists $9/month or $119 one-time; mature Ajv/Joi remain free local incumbents

## Unit economics before tax/FX/refunds/support
- Pro approximate net after Paddle standard fee: $3.29 per monthly checkout
- Team approximate net after Paddle standard fee: $8.04 per monthly checkout
- Oracle hosting cash cost is currently $0 inside the free allocation, but this is not treated as permanent zero economic cost
- Core 100-record smoke: about 0.04s and 46.9 MiB max RSS, so quotas are intentionally conservative for the shared host

## Pricing rule
Do not claim cheapest. Do not increase quotas merely to compete. Re-evaluate after sustained installs, real hosted usage, support burden, conversion and server headroom are known

## Sources checked
- https://www.paddle.com/pricing
- https://csvbox.io/pricing/
- https://apify.com/tidytools/csv-quality-validator
- https://bubble.io/plugin/json-schema-validator-1791748709871x124059663234760700
