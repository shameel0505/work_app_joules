# AGENTS.md

## Project: Aidea Platform
A UAE on-demand task marketplace. Two-sided platform:
- Customers post tasks (errands, chores, pickups, home services)
- Taskers (verified workers) accept and complete them for payment

## Current Build Status
- [x] Prompt 1: Monorepo foundation — COMPLETE
- [ ] Prompt 2: Authentication
- [ ] Prompt 3: User & Tasker Profiles
- [ ] Prompt 4: Task Categories & Creation
- [ ] Prompt 5: Bidding & Task Acceptance
- [ ] Prompt 6: Real-time Chat & Location
- [ ] Prompt 7: Payments & Wallet (simulated)
- [ ] Prompt 8: Reviews, Notifications & Admin API
- [ ] Prompt 9: Shared UI Package
- [ ] Prompt 10: Customer Mobile App
- [ ] Prompt 11: Tasker Mobile App
- [ ] Prompt 12: Admin Dashboard
- [ ] Prompt 13: Arabic i18n & RTL

## Monorepo Structure
- `packages/api/` — Fastify + Node.js backend with Prisma ORM (PostgreSQL)
- `apps/customer-app/` — React Native (Expo) customer mobile app
- `apps/tasker-app/` — React Native (Expo) tasker mobile app
- `apps/admin-dashboard/` — Next.js 14 admin web dashboard
- `packages/shared-types/` — TypeScript types shared across all packages
- `packages/shared-ui/` — Shared React Native design tokens + components

## Tech Conventions
- TypeScript everywhere, strict mode
- Fastify (not Express) for the API
- Prisma for all database access — never raw SQL
- Zod for all input validation
- React Native with NativeWind for mobile styling
- pnpm workspaces for monorepo management
- All API routes versioned: /api/v1/...
- JWT: access token (15min) + refresh token (7 days)
- Error format: { success: false, error: { code: string, message: string } }
- Success format: { success: true, data: ... }
- Money stored as integer fils (1 AED = 100 fils) — never floats
- Dates in ISO 8601 UTC

## Dev Services (Free — No Paid APIs in Development)
- File storage: MinIO at http://localhost:9000 (S3-compatible)
- OTP: Returned in API response body when OTP_DEV_MODE=true
- Payments: Fully simulated mock service when PAYMENT_SIMULATION=true
- Push notifications: console.log in development
- Maps: OpenStreetMap (no API key needed)
- Email: Mailhog at localhost:1025 (SMTP) / localhost:8025 (UI)
- AI features: Not implemented (added after business launch)

## Environment
- Local dev: docker-compose up starts PostgreSQL, Redis, MinIO, Mailhog
- Never hardcode secrets — use process.env validated with Zod at startup
- See packages/api/.env.example for all required variables
