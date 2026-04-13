# Patungin MVP

Mobile-first split bill MVP for Indonesia-first users, with English support.

## Included
- Next.js frontend with Tailwind + Zustand
- Express backend with clean architecture (controllers/services/routes/models)
- PostgreSQL schema via Prisma
- Core finance logic:
  - equal split
  - custom split
  - per-item style split payload support
  - debt simplification (minimum transfer graph)
- Friendly reminder tone in Bahasa and English

## Project Structure
- frontend/: Next.js app router UI
- backend/: Express + Prisma API
- docs/: endpoint catalog and SQL schema

## Quick Start
1. Backend
   - Copy backend/.env.example to backend/.env
   - Fill DATABASE_URL and JWT_SECRET
   - Install deps: npm install
   - Generate prisma client: npm run prisma:generate
   - Migrate schema: npm run prisma:migrate
   - Start dev server: npm run dev

2. Frontend
   - Copy frontend/.env.local.example to frontend/.env.local
   - Install deps: npm install
   - Start app: npm run dev

## Optional AI Feature
OCR receipt scanning can be added by plugging an OCR provider into frontend capture flow and posting parsed totals/items to /api/expenses.
