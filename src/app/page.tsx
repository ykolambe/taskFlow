import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Lock,
  MessageCircle,
  RotateCcw,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export default function MarketingHomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-surface-950 text-surface-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[520px] h-[520px] bg-primary-600/12 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-accent-500/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(9,13,23,0.65)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <header className="relative z-10 shrink-0 border-b border-surface-800/60 bg-surface-950/70 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-700 rounded-xl shadow-lg shadow-primary-900/50 ring-1 ring-primary-400/25">
              <Zap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold tracking-tight text-surface-50">TaskFlow</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <a
              href="#benefits"
              className="hidden sm:inline text-surface-400 hover:text-surface-100 transition-colors px-2 py-1.5 rounded-lg"
            >
              Benefits
            </a>
            <a
              href="#addons"
              className="hidden sm:inline text-surface-400 hover:text-surface-100 transition-colors px-2 py-1.5 rounded-lg"
            >
              Add-ons
            </a>
            <Link
              href="/login"
              className="text-surface-400 hover:text-surface-100 transition-colors px-3 py-1.5 rounded-lg"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2 shadow-lg shadow-primary-900/40 transition-colors"
            >
              Start for your team
              <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 md:pt-24 md:pb-24">
          <div className="max-w-3xl">
            <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-4">
              For leaders who need work to stay visible
            </p>
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] text-surface-50">
              Give your organization one place to assign work, track progress, and approve what matters.
            </h1>
            <p className="mt-6 text-lg text-surface-400 leading-relaxed">
              Whether you run a department, a program, or a growing company, TaskFlow helps managers set priorities,
              teams execute with clarity, and nothing important slips through the cracks—optionally with chat, repeating
              work, and AI help when you want them.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3.5 shadow-xl shadow-primary-900/45 transition-colors"
              >
                Register your organization
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-surface-600 bg-surface-900/50 hover:bg-surface-800/80 text-surface-100 font-semibold px-6 py-3.5 transition-colors"
              >
                Log in to your workspace
              </Link>
            </div>
            <p className="mt-6 text-sm text-surface-500">
              Already use TaskFlow with another company?{" "}
              <Link href="/login" className="text-primary-400 hover:text-primary-300 underline-offset-2 hover:underline">
                Sign in here
              </Link>
              <span className="text-surface-600 mx-2">·</span>
              <Link
                href="/platform/login"
                className="text-surface-500 hover:text-surface-300 underline-offset-2 hover:underline text-xs"
              >
                Partner / operator sign-in
              </Link>
            </p>
          </div>

          <div id="benefits" className="mt-16 scroll-mt-24 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Clear ownership",
                body: "See who does what, who reports to whom, and which approvals are still waiting—without digging through email threads.",
                icon: Users,
              },
              {
                title: "Fewer status meetings",
                body: "Dashboards, calendars, and task boards give everyone the same picture so you spend time on decisions, not chasing updates.",
                icon: LayoutGrid,
              },
              {
                title: "Built for real hierarchies",
                body: "Match how your org actually works: managers, leads, and contributors—with guardrails so requests go to the right level.",
                icon: GitBranch,
              },
            ].map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]"
              >
                <div className="inline-flex w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/25 items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary-300" />
                </div>
                <h2 className="text-base font-semibold text-surface-50">{title}</h2>
                <p className="text-sm text-surface-500 mt-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div id="addons" className="mt-20 scroll-mt-24">
            <div className="max-w-2xl mb-8">
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Add-ons when you need them</p>
              <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50">
                Start with core task management—then layer on what your team actually uses.
              </h2>
              <p className="text-surface-400 text-sm mt-3 leading-relaxed">
                Pick optional capabilities during signup. You only pay for what you turn on; your people see a single,
                consistent experience.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: MessageCircle,
                  name: "Team chat",
                  benefit: "Channels and direct messages next to the work—so decisions and handoffs stay where the tasks live.",
                  foot: "Great for distributed teams and daily coordination.",
                },
                {
                  icon: RotateCcw,
                  name: "Recurring tasks",
                  benefit: "Automate the work that comes back every week or month—reviews, checklists, reports—so nothing is forgotten.",
                  foot: "Ideal for compliance rhythms and operations cadences.",
                },
                {
                  icon: Sparkles,
                  name: "AI assistance",
                  benefit: "Optional AI to draft summaries, answer leader questions, and speed up repetitive writing—on your terms.",
                  foot: "Turn on when you want extra leverage for managers.",
                },
              ].map(({ icon: Icon, name, benefit, foot }) => (
                <div
                  key={name}
                  className="rounded-2xl border border-surface-800/80 bg-surface-900/50 p-6 backdrop-blur-sm ring-1 ring-inset ring-primary-500/10 flex flex-col"
                >
                  <div className="inline-flex w-11 h-11 rounded-xl bg-primary-500/15 border border-primary-500/30 items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary-200" />
                  </div>
                  <h3 className="text-lg font-semibold text-surface-50">{name}</h3>
                  <p className="text-sm text-surface-400 mt-2 leading-relaxed flex-1">{benefit}</p>
                  <p className="text-xs text-surface-500 mt-4 pt-4 border-t border-surface-800/80">{foot}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-5 py-3 transition-colors"
              >
                Choose add-ons at signup
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-surface-500 self-center max-w-md">
                Plans and prices shown in the signup flow reflect your environment (free tier or paid checkout where
                configured).
              </p>
            </div>
          </div>

          <div className="mt-20 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Get started in three steps</p>
              <ol className="space-y-4 text-sm text-surface-400">
                <li className="flex gap-3">
                  <span className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/25 text-primary-300 font-semibold flex items-center justify-center flex-shrink-0 text-sm">
                    1
                  </span>
                  <span>
                    <span className="text-surface-200 font-medium">Register your organization</span> — name, web
                    address for your team, and your admin account.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/25 text-primary-300 font-semibold flex items-center justify-center flex-shrink-0 text-sm">
                    2
                  </span>
                  <span>
                    <span className="text-surface-200 font-medium">Choose plan and add-ons</span> — core tasks and
                    hierarchy included; chat, recurring work, and AI when you need them.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/25 text-primary-300 font-semibold flex items-center justify-center flex-shrink-0 text-sm">
                    3
                  </span>
                  <span>
                    <span className="text-surface-200 font-medium">Invite your people</span> — set roles, org structure,
                    and start assigning work the same day.
                  </span>
                </li>
              </ol>
            </div>
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04] lg:col-span-2">
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">How your team will work</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: ListChecks,
                    title: "Tasks & priorities",
                    body: "Capture work with owners, due dates, and statuses everyone understands.",
                  },
                  {
                    icon: CalendarDays,
                    title: "Calendar & load",
                    body: "See what’s due and who’s carrying the load across the team.",
                  },
                  {
                    icon: CheckCircle2,
                    title: "Approvals",
                    body: "Route hiring and access-style requests to the right manager—tracked end to end.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-surface-800/70 bg-surface-950/35 p-4"
                  >
                    <div className="inline-flex w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 items-center justify-center mb-2">
                      <Icon className="w-4 h-4 text-primary-300" />
                    </div>
                    <p className="text-sm font-semibold text-surface-50">{title}</p>
                    <p className="text-xs text-surface-500 mt-1.5 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-surface-500 mt-5 leading-relaxed">
                Your colleagues sign in with their work email. Password resets use secure links sent to their inbox—no
                separate “IT portal” required for day-to-day use.
              </p>
            </div>
          </div>

          <section className="mt-20">
            <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Who uses TaskFlow</p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50 max-w-3xl">
              From small teams to complex org charts
            </h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Operations & delivery",
                "Program & project offices",
                "Professional services",
                "Internal IT / shared services",
                "Growing companies",
                "Remote & hybrid teams",
              ].map((tag) => (
                <span
                  key={tag}
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-surface-700 bg-surface-900/50 text-surface-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Inside your workspace</p>
                <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50">
                  One hub for tasks, structure, and conversation
                </h2>
                <p className="text-surface-400 text-sm mt-3 max-w-2xl">
                  After you register, your team gets a dedicated space—your branding, your people, your rules—not a
                  shared public board.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 shadow-xl shadow-primary-900/30 transition-colors shrink-0"
              >
                Create your space <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-8 grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <div className="rounded-xl bg-surface-950/40 border border-surface-800/70 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800/70 bg-surface-900/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-400/90" />
                      <div className="w-2.5 h-2.5 rounded-full bg-accent-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                      <p className="text-xs text-surface-500 ml-2 truncate">Your organization — TaskFlow</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 border border-primary-500/20 px-2 py-1 text-[11px] text-primary-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary-400" />
                      Approvals on track
                    </span>
                  </div>
                  <div className="p-4 grid sm:grid-cols-3 gap-3">
                    {[
                      { icon: GitBranch, title: "Org chart", desc: "Reporting lines at a glance." },
                      { icon: LayoutGrid, title: "Tasks & boards", desc: "Priorities, owners, deadlines." },
                      { icon: CheckCircle2, title: "Approvals", desc: "Requests routed to managers." },
                      { icon: MessageCircle, title: "Team chat", desc: "Optional—groups & DMs." },
                      { icon: CalendarDays, title: "Calendar", desc: "Plan work across the team." },
                      { icon: Shield, title: "Access by role", desc: "People see what they should." },
                    ].map(({ icon: Icon, title, desc }) => (
                      <div key={title} className="rounded-xl bg-surface-900/40 border border-surface-800/70 p-3">
                        <div className="inline-flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary-300" />
                          </div>
                          <p className="text-sm font-semibold text-surface-50">{title}</p>
                        </div>
                        <p className="text-xs text-surface-500 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface-900/30 border border-surface-800/70 px-3 py-2 text-xs text-surface-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Guided signup for your company
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface-900/30 border border-surface-800/70 px-3 py-2 text-xs text-surface-400">
                    <CheckCircle2 className="w-4 h-4 text-primary-400" />
                    Secure password reset by email
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                  <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">What you’ll do day one</p>
                  <div className="space-y-3">
                    {[
                      "Define your org structure and who reports to whom.",
                      "Create and assign tasks with clear owners and due dates.",
                      "Use approval flows when someone needs a manager’s yes.",
                      "Optional: turn on team chat so updates live next to the work.",
                      "Optional: schedule repeating tasks for audits and routines.",
                      "Optional: add AI help for summaries and leader Q&A.",
                    ].map((t) => (
                      <div key={t} className="flex items-start gap-3">
                        <span className="mt-0.5 w-7 h-7 rounded-xl bg-primary-500/10 border border-primary-500/25 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-primary-300" />
                        </span>
                        <p className="text-sm text-surface-300 leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">What leaders say</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    {
                      name: "Director of Operations",
                      quote:
                        "We finally stopped losing requests in email. Everyone sees the same priorities and approvals don’t stall.",
                    },
                    {
                      name: "Program manager",
                      quote:
                        "The org chart and task flow match how we actually run projects—not a generic tool we had to bend.",
                    },
                    {
                      name: "Head of a regional team",
                      quote:
                        "Optional chat next to tasks means my leads don’t jump between five apps for one decision.",
                    },
                    {
                      name: "Founder",
                      quote:
                        "We onboarded another division without rebuilding our process—same product, their own space.",
                    },
                  ].map((t) => (
                    <div key={t.name} className="rounded-xl bg-surface-950/35 border border-surface-800/70 p-5">
                      <p className="text-sm font-semibold text-surface-50">{t.name}</p>
                      <p className="text-sm text-surface-400 mt-2 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Simple pricing</p>
                <div className="rounded-xl bg-surface-950/35 border border-surface-800/70 p-5">
                  <p className="text-sm font-semibold text-surface-50">Core for your whole team</p>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                    Tasks, team structure, org visibility, and approvals—included in your workspace plan.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary-400" />
                    <p className="text-sm text-surface-300">Paid plans use secure card checkout where enabled.</p>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-surface-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      Add-ons: team chat, recurring tasks, AI—pick what fits.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      Change your subscription when your needs change.
                    </li>
                  </ul>
                  <div className="mt-5">
                    <Link
                      href="/signup"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-3 transition-colors"
                    >
                      See plans &amp; register <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Security & trust</p>
                <div className="space-y-4">
                  {[
                    {
                      title: "Your company’s space",
                      body: "Each organization gets its own workspace—your data and your people, separated from other companies.",
                    },
                    {
                      title: "Safe password recovery",
                      body: "Forgot-password links are time-limited and sent by email—no shared admin passwords floating around.",
                    },
                    {
                      title: "Approvals that respect the chain",
                      body: "Sensitive requests follow your hierarchy so authority stays clear and auditable.",
                    },
                  ].map((s) => (
                    <div key={s.title} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/25 flex items-center justify-center flex-shrink-0">
                        <Lock className="w-5 h-5 text-primary-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-50">{s.title}</p>
                        <p className="text-sm text-surface-400 mt-1 leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">FAQ</p>
                <div className="space-y-3">
                  {[
                    {
                      q: "Is this only for technical teams?",
                      a: "No. TaskFlow is built for business managers and teams—operations, programs, services—anywhere work needs owners and approvals.",
                    },
                    {
                      q: "How do my employees sign in?",
                      a: "They use their work email and a password they set. If someone forgets a password, they get a secure reset link by email.",
                    },
                    {
                      q: "Can we add chat or AI later?",
                      a: "Yes. You can include add-ons when you register or adjust your subscription when you’re ready.",
                    },
                    {
                      q: "Is our data separate from other customers?",
                      a: "Yes. Your workspace is scoped to your organization so people only see what belongs to your company.",
                    },
                  ].map((item) => (
                    <details key={item.q} className="group rounded-xl border border-surface-800/70 bg-surface-950/35 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-surface-50 list-none flex items-center justify-between gap-3">
                        <span>{item.q}</span>
                        <span className="text-surface-500 group-open:text-primary-300">+</span>
                      </summary>
                      <p className="text-sm text-surface-400 mt-2 leading-relaxed">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-14 pb-20">
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-7 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-2">
                    Ready when you are
                  </p>
                  <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50">
                    Bring your team onto one calm system for work and approvals.
                  </h2>
                  <p className="text-surface-400 text-sm mt-3 leading-relaxed">
                    Register in minutes, invite your managers and staff, and start assigning real work—not another pilot
                    that never ships.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3.5 shadow-xl shadow-primary-900/30 transition-colors"
                  >
                    Register your organization <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-600 bg-surface-900/50 hover:bg-surface-800/80 text-surface-100 font-semibold px-6 py-3.5 transition-colors"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>

      <footer className="relative z-10 border-t border-surface-800/60 py-8 text-center text-sm text-surface-500">
        <p>© {new Date().getFullYear()} TaskFlow</p>
        <p className="mt-2 text-xs text-surface-600">
          <Link href="/platform/login" className="hover:text-surface-400 underline-offset-2 hover:underline">
            Operator / reseller access
          </Link>
        </p>
      </footer>
    </div>
  );
}
