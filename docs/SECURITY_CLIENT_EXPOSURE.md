# Client exposure and API error hygiene

This note supports periodic reviews of what can be inferred from shipped browser assets and JSON responses. It is not a penetration test.

## What browsers always receive

- Compiled JavaScript bundles for `"use client"` trees and shared modules they import.
- HTML and RSC payloads for each navigation.
- Network responses from `/api/*` and cookies your app sets.

Original TypeScript source is not served unless **production browser source maps** are enabled (they are not in this repo’s `next.config.ts`).

## `NEXT_PUBLIC_*` variables

Any `NEXT_PUBLIC_` name is **inlined at build time** into client bundles. Treat them as **public**.

**Review checklist (each release):**

1. List usages: `npm run security:audit-client` (or `rg "NEXT_PUBLIC_" src --glob '!**/*.md'`).
2. Confirm each value is safe if published (URLs, Stripe **publishable** key, VAPID **public** key, marketing copy only).
3. Never put server secrets in `NEXT_PUBLIC_*`.

## API routes and 500 responses

Prefer generic client messages for unexpected failures (`"Internal server error"` or domain-specific safe strings) and log details **server-side only** with `console.error`.

**Grep for risky patterns:**

```bash
rg "NextResponse\.json\(\{[^}]*error:[^}]*\.message" src/app/api
rg "error:\\s*\\(?e|err|error\\)?\\.message" src/app/api
```

Fix any match that returns raw exception text to browsers.

## JWT and sessions

Production requires `JWT_SECRET` (see `src/lib/jwtSecret.ts` and `.env.example`). Missing or short secrets cause startup failures on first auth use in production, not silent fallback.

## Security headers

Baseline headers (CSP, frame controls, HSTS in production) are defined in `next.config.ts`. Tune CSP when adding new third-party scripts or if a feature is blocked in the browser console.

## Optional hardening

- Rate limiting on `/api/*/login` and signup OTP routes.
- Dependency scanning in CI (`npm audit`).
- Third-party security assessment for buyer or compliance requirements.
