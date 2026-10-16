# Reporter note (synthetic)

> Synthetic lab evidence. Fictional reporter and team; not a real Lucid finding.

- Reporter: billing-analytics analyst (fictional), filed via the intake queue on 2026-10-08.
- Symptom: the monthly charging summary for fleet account `fleet-alpha` included a 29.4 kWh session in `synthetic-zone-east`. fleet-alpha has no chargers in that zone.
- The billing job builds each account's summary by calling the charging session lookup with the account's own caller scope and a session ID from the billing line items.
- The reporter's severity is `high` (billing totals and location zones of another fleet visible).
- The reporter has not checked whether existing tickets cover this. No test was attached.
