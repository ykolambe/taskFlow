# TaskFlow — Multi-Tenant Task Management SaaS

A beautiful, mobile-optimized multi-tenant SaaS platform for team task management with organizational hierarchy.

## ✨ Features

### Platform Owner
- 🏢 Create & manage multiple companies (tenants)
- 🔑 Generate/regenerate super admin credentials per company
- 📊 Platform-level dashboard with stats
- ⚙️ Enable/disable companies and modules

### Per-Company (Tenant)
- 🌳 **Org Chart** — Beautiful tree visualization with custom role levels
- ✅ **Task Management** — Full workflow: To Do → In Progress → Ready for Review → Completed
- 📋 **Task Rules** — Assignee submits, creator/upper levels complete; completed tasks auto-archive
- 🔄 **Recurring Tasks** — Daily, weekly (specific days), or monthly
- 👥 **Team Management** — Add members with optional approval workflow
- 📬 **Approval Requests** — Lower levels request new members, managers approve/reject
- 🎨 **Beautiful UI** — Dark mode, mobile-first, smooth experience

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` and update the `DATABASE_URL` with your PostgreSQL connection string.

### 3. Set up the database
```bash
# Push schema to database
npm run db:push

# Seed with demo data
npm run db:seed
```

### 4. Start development server
```bash
npm run dev
```

---

## 🔐 Default Credentials

After seeding, you'll have:

### Platform Owner
| URL | `http://localhost:3000/platform/login` |
|-----|-------|
| Email | `admin@platform.com` |
| Password | `Platform@123` |

### Demo Company: Acme Corp
| URL | `http://localhost:3000/t/acme/login` |
|-----|-------|
| Super Admin | `admin@acme.com` / `Admin@123` |
| Manager | `manager@acme.com` / `Manager@123` |
| Supervisor 1 | `alex@acme.com` / `Alex@123` |
| Supervisor 2 | `maria@acme.com` / `Maria@123` |
| Team Member | `tom@acme.com` / `Tom@123` |
| Team Member | `lisa@acme.com` / `Lisa@123` |
| Team Member | `mike@acme.com` / `Mike@123` |

---

## 📱 URL Structure

### Local Development
```
http://localhost:3000/platform/login     ← Platform owner login
http://localhost:3000/platform/dashboard ← Platform dashboard
http://localhost:3000/t/[slug]/login     ← Tenant login
http://localhost:3000/t/[slug]/dashboard ← Tenant dashboard
```

### Production (Subdomain)
```
https://app.yourdomain.com/platform/login
https://company1.yourdomain.com/dashboard
```

To enable subdomain routing in production, set `ROOT_DOMAIN=yourdomain.com` in `.env`.

---

## Progressive Web App (PWA)

TaskFlow exposes a root [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) (`/manifest.webmanifest`) for platform flows, and a **per-workspace manifest** at `/t/[slug]/manifest` for tenant routes. Add to Home Screen from a tenant URL (e.g. `/t/yta/login`) uses that manifest so **`start_url`** and **`scope`** apply only to that institute.

- **Production:** Install prompts require a **secure origin** (HTTPS). Use your real domain or a tunnel (e.g. ngrok) for testing install behavior—not plain `http://localhost` on all devices.
- **Icons:** PNG assets are generated from `public/icon.svg`. After changing the SVG, run:
  ```bash
  npm run pwa:icons
  ```
- **Checking:** Chrome DevTools → **Application** → **Manifest**. On iOS Safari: **Share** → **Add to Home Screen**.
- **Service worker:** Not included yet. Cookie-based auth makes aggressive offline caching risky; a future SW should use **network-first** for pages and `/api/*`.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── platform/          # Platform owner pages
│   ├── t/[slug]/          # Tenant pages (per company)
│   ├── api/
│   │   ├── platform/      # Platform API routes
│   │   ├── t/[slug]/      # Tenant API routes
│   │   └── upload/        # File upload
│   └── globals.css
├── components/
│   ├── ui/                # Reusable UI components
│   ├── layout/            # Platform & Tenant layouts
│   ├── platform/          # Platform-specific components
│   └── tenant/            # Tenant-specific components
├── lib/
│   ├── prisma.ts           # DB client
│   ├── auth.ts             # JWT helpers
│   └── utils.ts            # Utilities
├── middleware.ts            # Subdomain routing + auth
└── types/index.ts          # TypeScript types
prisma/
├── schema.prisma            # Database schema
└── seed.ts                  # Demo data seed
```

---

## ⚙️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:reset` | Reset DB and re-seed |

---

## 🏗️ Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Custom JWT (cookies, Edge-compatible)
- **Styling**: Tailwind CSS (dark mode, mobile-first)
- **Multi-tenancy**: Middleware subdomain rewriting to `/t/[slug]` paths

---

## 🔄 Task Workflow

```
TODO → IN_PROGRESS → READY_FOR_REVIEW → COMPLETED
        ↑ (assignee)    ↑ (assignee)      ↑ (creator / upper level)
```

- **Completed tasks** are auto-archived and hidden from assignee
- Only the task creator (or higher in hierarchy) can mark as Completed
- Archived tasks are visible to upper levels

---

## 👥 Hierarchy Rules

- Users can only see people **below them** and **above them** in the tree
- Tasks can only be assigned to **yourself or people below you**
- To add a team member, lower levels must **submit an approval request**
- Super admin can directly add any member

---

## 🔧 Production Setup

1. Set `ROOT_DOMAIN=yourdomain.com` in environment
2. Configure your DNS to point `*.yourdomain.com` to your server
3. Set `JWT_SECRET` to a strong random string
4. Set `NODE_ENV=production`
5. Run `npm run build && npm start`
# taskFlow

---

## Executive AI Brief (Gemini)

Top-level leaders can generate an on-demand AI brief from the tenant dashboard.

### Setup

1. Add a Gemini key to your environment:

```bash
GEMINI_API_KEY="your-gemini-api-key"
```

2. Start the app and log in as a super admin or level 1-2 executive user.
3. Go to `/t/[slug]/dashboard` and click **Generate Brief** in the **Executive AI Brief** card.

### Notes

- Calls are server-side only (key is never exposed to browser).
- Endpoint: `POST /api/t/[slug]/ai/executive-brief`
- If Gemini is unavailable, the app returns a deterministic fallback brief based on current metrics.

### Company AI add-on gating

- AI features are available only when the company billing setting `AI Add-on` is enabled.
- Platform admins can configure:
  - `AI Add-on` toggle
  - `AI Price / Seat`
  - monthly AI revenue preview (`active users * AI price per seat`)
- When disabled:
  - tenant AI UI shows a locked hint
  - AI API routes return `403`

### LeaderGPT (No RAG)

- Natural-language leadership Q&A is SQL-grounded (no vector retrieval).
- Endpoint: `POST /api/t/[slug]/ai/leader-qa`
- Access requirements:
  - company AI add-on enabled
  - user-level entitlement `aiLeaderQaEnabled = true`
- Entitlement is managed by tenant super admin from Team page member details.
- UI appears as a bottom-right chat bubble on dashboard only.

### LeaderGPT prompt help

- Ask with explicit scope for best outcomes: `direct reports`, `team`, `role`, or specific names.
- For task creation, include: goal/title, target scope, priority, and due date.
- For bulk commands, use plain language:
  - `Create weekly check-in tasks for all direct reports, HIGH priority, due Friday`
  - `Create onboarding tasks for role supervisors, MEDIUM priority, due next Monday`
  - `Create status update tasks for Alex, Maria, Tom, due tomorrow`
- Review preview output before confirm: warnings and skipped entries indicate what needs clarification.

### Bulk planning commands (V1)

- Supported in chat: **bulk create tasks** only.
- Flow uses strict guardrails:
  - AI generates a dry-run preview (`bulk_create_preview`)
  - user must explicitly confirm (`confirm_bulk_create`)
  - preview includes skipped targets with reason when resolution fails
  - server revalidates permissions before creating tasks
- Safety limits:
  - hard cap: 50 tasks per bulk command
  - warning shown above 20 tasks + second confirmation required
  - command rate-limited per user/company
- Audit trail marker is appended to created task descriptions (`created_via_ai_bulk`).

### Tenant-isolated infra control-plane (hybrid)

- Platform admin can now configure tenant runtime infra from company detail:
  - deployment mode: `SHARED | DEDICATED`
  - backend/frontend targets
  - DB metadata + secret refs (no plaintext credentials in DB)
  - per-tenant AI provider/model/key ref + daily request budget
- New APIs:
  - `PATCH /api/platform/companies/[id]/infra`
  - `GET|POST /api/platform/companies/[id]/provisioning`
  - `POST /api/platform/provisioning/run` (platform auth or `PROVISIONING_RUN_TOKEN`)
- Provisioning is asynchronous via `tenant_provisioning_jobs` with idempotency key support.
- Runtime resolver endpoint: `GET /api/t/[slug]/runtime`.

### Chat and recurring add-on gating

- `chat` and `recurring` are explicit paid add-ons in company billing.
- Access requires both:
  - module enabled in company modules (`chat`, `recurring`)
  - corresponding billing add-on enabled (`chatAddonEnabled`, `recurringAddonEnabled`)
- Protected APIs return `403` when disabled:
  - chat channels/messages APIs
  - recurring tasks API

### Migration helper

- Existing tenants can be initialized with:
  - `POST /api/platform/migrations/tenant-infra`
- It upserts default infra config (`SHARED`, `READY`) and billing add-on rows aligned with current enabled modules.

