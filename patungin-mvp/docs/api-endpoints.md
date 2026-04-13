# Patungin API Endpoints

Base URL: /api

## Auth
- POST /auth/register
  - body: { email, password, displayName, locale }
  - response: user profile
- POST /auth/login
  - body: { email, password }
  - response: { token, user }

## Groups
- GET /groups
  - auth required
  - list groups for current user
- POST /groups
  - auth required
  - body: { name, description, currency, participants[] }
- GET /groups/:groupId
  - auth required
  - returns group, members, expenses, settlements
- GET /groups/:groupId/balances
  - auth required
  - returns net balance per member
- GET /groups/:groupId/settlements
  - auth required
  - recalculates and returns simplified debts

## Expenses
- POST /expenses
  - auth required
  - body: { groupId, title, totalAmount, payerMemberId, splitMethod, participants[] }
  - splitMethod: EQUAL | CUSTOM | PER_ITEM

## Reminders
- POST /reminders
  - auth required
  - body: { settlementId, locale }
  - generates friendly reminder message
- PATCH /reminders/settlements/:settlementId/pay
  - auth required
  - mark settlement as PAID

## Health
- GET /health
