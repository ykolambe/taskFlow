# Web Push (PWA) — deployment guide

Use this when you have **HTTPS and a stable hostname** (or for **local dev** / **HTTPS tunnel** testing). The app code is already in the repo; this doc is the checklist to turn it on in each environment.

## Requirements

- **HTTPS** in production (or `http://localhost` / `http://127.0.0.1` for dev). Plain **`http://` + public IP** is not a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) — push and service workers will not behave reliably for users.
- **PostgreSQL** schema includes `push_subscriptions` and `scheduled_pushes` (see Prisma migrations under `prisma/migrations/`).
- **Environment variables** set on the server (see below).

## 1. Generate VAPID keys

From the project root (after `npm install`):

```bash
npx web-push generate-vapid-keys
```

Copy the **Public** and **Private** keys.

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key (safe to expose to the browser) |
| `VAPID_PRIVATE_KEY` | Private key (**server only** — never commit to client bundles) |
| `VAPID_SUBJECT` | `mailto:you@yourdomain.com` or `https://yourdomain.com` (contact for push services) |

Also documented in `.env.example` under “Web Push”.

## 2. Cron secret (scheduled broadcasts)

Scheduled jobs are processed when something calls the dispatcher:

- **Route:** `POST` or `GET` `/api/cron/push-scheduled`
- **Auth:** `Authorization: Bearer <CRON_SECRET>` **or** query `?secret=<CRON_SECRET>`

Set a long random value:

```bash
openssl rand -hex 32
```

Put it in `CRON_SECRET` in your host’s environment.

Example manual call:

```bash
curl -X POST "https://YOUR_DOMAIN/api/cron/push-scheduled" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Run this on a schedule (e.g. every minute) via your host’s cron (Vercel Cron, GitHub Actions, systemd timer, etc.). Without cron, **instant** pushes (e.g. task assigned) still work for subscribed users; **scheduled** pushes will not dispatch until the endpoint runs.

## 3. Database

Apply migrations in deploy:

```bash
npx prisma migrate deploy
```

If you only use `prisma db push` in dev, align with your team’s process; the migration that adds Web Push tables is under `prisma/migrations/`.

## 4. Smoke test

1. Open the app over **HTTPS**, sign in, go to **Profile → Notifications** and enable push (grant browser permission).
2. Assign a task to **another** user who also enabled notifications — they should get a push.
3. (Optional) Schedule a broadcast from tenant **Settings** (super admin) or **Platform → Push**, then trigger the cron and confirm delivery after the scheduled time.

## 5. Before you have HTTPS (IP-only HTTP)

- **Local:** use `http://localhost:PORT` — secure context for dev.
- **Remote without a cert yet:** use an **HTTPS tunnel** (ngrok, Cloudflare Tunnel, etc.) and open the **https://** URL they provide.
- **Production:** use your domain + TLS (Let’s Encrypt or your provider’s certificate).

## Related code (reference)

- Service worker: `public/sw.js` (`push`, `notificationclick`)
- Server send helper: `src/lib/pushNotifications.ts`
- Subscribe APIs: `src/app/api/t/[slug]/push/`
- Cron: `src/app/api/cron/push-scheduled/route.ts`
- Profile UI: `src/components/tenant/PushNotificationSettings.tsx`
- Platform scheduled UI: `src/app/platform/push/page.tsx`
