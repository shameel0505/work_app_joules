# AGENTS.md

## Project: Aidea Platform
A UAE on-demand task marketplace (like Uber for errands). Two-sided platform:
- Customers post tasks
- Taskers (verified workers) accept and complete them

## Monorepo Structure
- `packages/api/` — Fastify + Node.js backend with Prisma ORM (PostgreSQL)
- `apps/customer-app/` — React Native (Expo) customer-facing mobile app
- `apps/tasker-app/` — React Native (Expo) tasker-facing mobile app
- `apps/admin-dashboard/` — Next.js 14 admin web dashboard
- `packages/shared-types/` — TypeScript types shared across all packages

## Tech conventions
- TypeScript everywhere, strict mode
- Fastify (not Express) for the API
- Prisma for all database access — never raw SQL
- Zod for all input validation (API and app forms)
- React Native with NativeWind (Tailwind for RN) for styling
- pnpm workspaces for monorepo management
- All API routes are versioned: /api/v1/...
- JWT auth: access token (15min) + refresh token (7 days) stored in httpOnly cookie
- Error format: { success: false, error: { code: string, message: string } }
- Success format: { success: true, data: ... }
- All money values stored in fils (1 AED = 100 fils) as integers — never floats
- Dates in ISO 8601 UTC format

## Environment Variables
See `.env.example` in each package root for required vars.
Never hardcode secrets. Use process.env with Zod validation at startup.

## Testing
- Jest for unit tests
- Supertest for API integration tests
- Test files co-located: `foo.service.test.ts` next to `foo.service.ts`
