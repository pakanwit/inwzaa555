# Balance computed in TypeScript, not a SQL view

The design spec called for a `v_balances` SQL view. We chose to keep balance computation in `lib/balance.ts` — a pure TypeScript function — instead. The function was written and fully tested before backend development began, implements the spec formula exactly, and runs in Vitest with zero DB infrastructure. Drizzle has no ergonomic first-class view support (raw SQL queries, lost type safety), and a plain Postgres view is not materialised — it offers no caching benefit for a group of ~10 members. The dashboard fetches three tables server-side and passes the rows to `computeBalances()`.

Reverse this if query count on the dashboard becomes a bottleneck at larger member counts, or if we add a materialized view for caching.
