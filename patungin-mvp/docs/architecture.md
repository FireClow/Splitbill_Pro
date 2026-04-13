# Architecture Notes

## Backend
- controllers: request parsing and response shaping
- services: business logic, split calculation, debt simplification
- routes: endpoint registration and auth middleware boundaries
- models: zod validation schemas
- config: env + Prisma setup

## Frontend
- app: pages/routes (dashboard, group detail, add expense)
- components: reusable UI blocks
- hooks: i18n helper
- store: zustand global state (language toggle)
- lib: API client
- messages: localized strings (id/en)

## Core Algorithms
- Equal split:
  - Convert total to cents
  - Distribute base amount equally
  - Distribute remainder to first members
  - Guarantees exact sum
- Debt simplification:
  - Compute net balance for each member
  - Greedy match highest creditor with highest debtor
  - Produces fewer transactions and preserves totals
