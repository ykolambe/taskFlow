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
