import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  GitBranch,
  LayoutGrid,
  Lock,
  MailPlus,
  Plug,
  Sparkles,
  Shield,
  MessageCircle,
  Workflow,
  Zap,
} from "lucide-react";

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex flex-col">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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

      <header className="relative z-10 border-b border-surface-800/60 backdrop-blur-sm bg-surface-950/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-700 rounded-xl shadow-lg shadow-primary-900/50 ring-1 ring-primary-400/25">
              <Zap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold tracking-tight text-surface-50">TaskFlow</span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
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
              Create workspace
              <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-3xl">
            <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-4">
              Multi-tenant task management
            </p>
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] text-surface-50">
              Run every workspace from one calm command center.
            </h1>
            <p className="mt-6 text-lg text-surface-400 leading-relaxed">
              Assign work, align teams, and keep approvals moving — with optional chat, recurring tasks, and AI
              assistance when you need them.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3.5 shadow-xl shadow-primary-900/45 transition-colors"
              >
                Create workspace
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-surface-600 bg-surface-900/50 hover:bg-surface-800/80 text-surface-100 font-semibold px-6 py-3.5 transition-colors"
              >
                Log in
              </Link>
            </div>
            <p className="mt-6 text-sm text-surface-500">
              Need internal platform access?{" "}
              <Link href="/platform/login" className="text-primary-400 hover:text-primary-300 underline-offset-2 hover:underline">
                Platform admin
              </Link>
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">How it works</p>
              <ol className="space-y-3 text-sm text-surface-400">
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-xl bg-primary-500/10 border border-primary-500/25 text-primary-300 font-semibold flex items-center justify-center flex-shrink-0">1</span>
                  <span>Create your workspace and choose add-ons.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-xl bg-primary-500/10 border border-primary-500/25 text-primary-300 font-semibold flex items-center justify-center flex-shrink-0">2</span>
                  <span>Pay securely with Stripe subscriptions.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-xl bg-primary-500/10 border border-primary-500/25 text-primary-300 font-semibold flex items-center justify-center flex-shrink-0">3</span>
                  <span>Start organizing tasks, approvals, and chat.</span>
                </li>
              </ol>
            </div>
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Email-based auth</p>
              <p className="text-sm text-surface-400 leading-relaxed">
                Login to your workspace using your email address. Forgot passwords use real transactional emails with time-limited reset links.
              </p>
            </div>
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Built for teams</p>
              <p className="text-sm text-surface-400 leading-relaxed">
                Set up your institute once, then manage everyone with hierarchy-aware approvals, tasks, and (optionally) chat and recurring schedules.
              </p>
            </div>
          </div>

          {/* Trello-style narrative blocks */}
          <section className="mt-14 space-y-10">
            <div>
              <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">
                Your productivity powerhouse
              </p>
              <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50">
                Inbox, Boards, and Planner in one place
              </h2>
              <p className="text-surface-400 text-sm mt-3 max-w-3xl">
                Capture work from anywhere, organize by status, and plan execution by date. The UI stays simple even as your team scales.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: MailPlus,
                  title: "Inbox",
                  body: "Capture requests and follow-ups instantly so nothing gets lost.",
                },
                {
                  icon: LayoutGrid,
                  title: "Boards",
                  body: "Move tasks across statuses with clear ownership and visibility.",
                },
                {
                  icon: CalendarDays,
                  title: "Planner",
                  body: "Schedule due dates and view workload by calendar and hierarchy.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-5 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]"
                >
                  <div className="inline-flex w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/25 items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary-300" />
                  </div>
                  <p className="text-base font-semibold text-surface-50">{title}</p>
                  <p className="text-sm text-surface-500 mt-1.5 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">
                  From message to action
                </p>
                <h3 className="text-xl font-semibold text-surface-50">Turn conversations into trackable tasks</h3>
                <p className="text-sm text-surface-400 mt-2 leading-relaxed">
                  Use channels and direct messages, then convert important decisions into tasks and approval flows without context switching.
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-surface-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                    DM and channel conversations stay linked to execution.
                  </div>
                  <div className="flex items-start gap-2 text-surface-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                    Attach media, discuss, and assign follow-up immediately.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">
                  Do more with automation
                </p>
                <h3 className="text-xl font-semibold text-surface-50">Integrations, workflows, and AI assistance</h3>
                <p className="text-sm text-surface-400 mt-2 leading-relaxed">
                  Combine recurring workflows, approval routing, and optional AI support to keep teams aligned without manual overhead.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-surface-950/40 border border-surface-800/70 px-3 py-2 text-center">
                    <Plug className="w-4 h-4 text-primary-300 mx-auto mb-1" />
                    <p className="text-[11px] text-surface-400">Integrations</p>
                  </div>
                  <div className="rounded-xl bg-surface-950/40 border border-surface-800/70 px-3 py-2 text-center">
                    <Workflow className="w-4 h-4 text-primary-300 mx-auto mb-1" />
                    <p className="text-[11px] text-surface-400">Automation</p>
                  </div>
                  <div className="rounded-xl bg-surface-950/40 border border-surface-800/70 px-3 py-2 text-center">
                    <Sparkles className="w-4 h-4 text-primary-300 mx-auto mb-1" />
                    <p className="text-[11px] text-surface-400">AI Assist</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 px-4 py-5 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <p className="text-xs text-surface-500 uppercase tracking-wider mb-3 text-center">Trusted by growing teams</p>
              <div className="flex flex-wrap justify-center gap-2">
                {["Institutes", "Operations Teams", "Program Offices", "Startups", "Remote Teams", "Delivery Teams"].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-surface-700 bg-surface-950/35 text-surface-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-20 grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: LayoutGrid,
                title: "Boards & workflows",
                body: "Statuses and hierarchy tuned to how your org actually works.",
              },
              {
                icon: Shield,
                title: "Tenant isolation",
                body: "Each workspace is its own boundary — secure by design.",
              },
              {
                icon: CheckCircle2,
                title: "Approvals built in",
                body: "Review loops that stay visible from request to done.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]"
              >
                <div className="inline-flex p-2 rounded-lg bg-primary-500/10 text-primary-400 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-surface-100">{title}</h2>
                <p className="mt-2 text-sm text-surface-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          {/* Demo */}
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">
                  Product demo
                </p>
                <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50">
                  Everything updates in real time
                </h2>
                <p className="text-surface-400 text-sm mt-3 max-w-2xl">
                  Create tasks, route approvals, visualize your org chart, and chat with your team — all within a single workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 shadow-xl shadow-primary-900/30 transition-colors"
                >
                  Try it now <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="mt-8 grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                {/* Mock UI */}
                <div className="rounded-xl bg-surface-950/40 border border-surface-800/70 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800/70 bg-surface-900/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-400/90" />
                      <div className="w-2.5 h-2.5 rounded-full bg-accent-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                      <p className="text-xs text-surface-500 ml-2 truncate">TaskFlow Workspace</p>
                    </div>
                    <div className="text-xs text-surface-500 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 border border-primary-500/20 px-2 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary-400" />
                        Live approvals
                      </span>
                    </div>
                  </div>

                  <div className="p-4 grid sm:grid-cols-3 gap-3">
                    {[
                      { icon: GitBranch, title: "Org chart", desc: "See reporting lines instantly." },
                      { icon: LayoutGrid, title: "Tasks", desc: "Due dates, priorities, statuses." },
                      { icon: CheckCircle2, title: "Approvals", desc: "Sequential manager approvals." },
                      { icon: MessageCircle, title: "Team chat", desc: "Groups + direct messages." },
                      { icon: CreditCard, title: "Billing", desc: "Stripe-based subscriptions." },
                      { icon: Lock, title: "Security", desc: "Tenant isolation by design." },
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
                    No setup scripts required
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface-900/30 border border-surface-800/70 px-3 py-2 text-xs text-surface-400">
                    <CheckCircle2 className="w-4 h-4 text-primary-400" />
                    Real email onboarding
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                  <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">What you can do</p>
                  <div className="space-y-3">
                    {[
                      "Create workspaces per institute with optional add-ons.",
                      "Manage hierarchy + org chart with role-level routing.",
                      "Add and remove team members with approvals.",
                      "Track tasks with due dates, status configs, and archiving.",
                      "Chat with your team (channels + DM).",
                      "Run Stripe subscriptions to enable/disable add-ons.",
                    ].map((t) => (
                      <div key={t} className="flex items-start gap-3">
                        <span className="mt-1 w-7 h-7 rounded-xl bg-primary-500/10 border border-primary-500/25 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-primary-300" />
                        </span>
                        <p className="text-sm text-surface-300 leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                  <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Fast onboarding</p>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    You pick your add-ons during signup. After Stripe checkout completes, your workspace is provisioned automatically.
                  </p>
                  <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    {[
                      { title: "1. Signup", body: "Choose workspace URL + add-ons." },
                      { title: "2. Stripe", body: "Subscription checkout for your plan." },
                      { title: "3. Login", body: "Email/password sign in + reset links." },
                      { title: "4. Provision", body: "Tenant DB + defaults created for you." },
                    ].map((s) => (
                      <div key={s.title} className="rounded-xl bg-surface-950/35 border border-surface-800/70 p-4">
                        <p className="text-sm font-semibold text-surface-50">{s.title}</p>
                        <p className="text-xs text-surface-500 mt-1">{s.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials + pricing */}
          <section className="mt-14">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Teams ship faster</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    {
                      name: "Operations Lead",
                      quote:
                        "Approvals used to be chaos. Now every request follows the hierarchy and nothing disappears.",
                    },
                    {
                      name: "Program Manager",
                      quote:
                        "The task workflow is clean, and the org chart makes it obvious who should approve what.",
                    },
                    {
                      name: "IT Coordinator",
                      quote:
                        "Direct messages + channels are simple enough for everyone, without extra setup.",
                    },
                    {
                      name: "Founder",
                      quote:
                        "The multi-tenant model means we can add institutes without extra infrastructure work.",
                    },
                  ].map((t) => (
                    <div key={t.name} className="rounded-xl bg-surface-950/35 border border-surface-800/70 p-5">
                      <p className="text-sm font-semibold text-surface-50">{t.name}</p>
                      <p className="text-sm text-surface-400 mt-2 leading-relaxed">“{t.quote}”</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Pricing</p>
                <div className="rounded-xl bg-surface-950/35 border border-surface-800/70 p-5">
                  <p className="text-sm font-semibold text-surface-50">Starter subscription</p>
                  <p className="text-xs text-surface-500 mt-1">
                    Includes core tasks, hierarchy, org chart, and approvals.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary-400" />
                    <p className="text-sm text-surface-300">Stripe checkout enabled</p>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-surface-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                      Optional add-ons: chat, recurring tasks, AI assistance
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                      Cancel or adjust anytime in Stripe
                    </li>
                  </ul>
                  <div className="mt-5">
                    <Link
                      href="/signup"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-3 transition-colors"
                    >
                      Start with signup <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security + FAQ */}
          <section className="mt-14">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-6 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
                <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-3">Security</p>
                <div className="space-y-4">
                  {[
                    { title: "Tenant isolation", body: "Data and workflows stay scoped to each workspace." },
                    { title: "Email reset links", body: "Password resets use time-limited tokens and transactional email." },
                    { title: "Role-based approvals", body: "Approvals follow the org hierarchy, not manual shortcuts." },
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
                      q: "Do I need to set up databases or infrastructure?",
                      a: "No. The platform provisions your tenant automatically after Stripe checkout completes.",
                    },
                    {
                      q: "How does login work?",
                      a: "Login is email-based for each workspace. Forgot password uses real transactional email with reset tokens.",
                    },
                    {
                      q: "Can we add optional modules later?",
                      a: "Yes. In Stripe you can enable add-ons such as chat, recurring tasks, and AI assistance.",
                    },
                    {
                      q: "Is tenant data isolated?",
                      a: "Yes. The app scopes all tenant data by workspace boundary, and critical actions are enforced server-side.",
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

          {/* Final CTA */}
          <section className="mt-14 pb-20">
            <div className="rounded-2xl border border-surface-800/80 bg-surface-900/40 p-7 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-2">
                    Ready for your institute workspace?
                  </p>
                  <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-semibold text-surface-50">
                    Create a workspace and start organizing today.
                  </h2>
                  <p className="text-surface-400 text-sm mt-3 leading-relaxed">
                    Provisioning is automatic, add-ons are subscription-based, and login/reset are handled via real email flows.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3.5 shadow-xl shadow-primary-900/30 transition-colors"
                  >
                    Create workspace <ArrowRight className="w-4 h-4" />
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
        © {new Date().getFullYear()} TaskFlow
      </footer>
    </div>
  );
}
