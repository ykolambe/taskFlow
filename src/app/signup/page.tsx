"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Check, Loader2, Lock, Mail, ShieldCheck, User, Zap } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

const SLUG_RE = /^[a-z0-9-]+$/;

function SignupWizard() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled");

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugOk, setSlugOk] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chat, setChat] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [ai, setAi] = useState(false);
  const [planTier, setPlanTier] = useState<"free" | "pro">("free");
  const [planInfo, setPlanInfo] = useState<{
    free: { label: string; priceLabel: string; seatLimit: number; description: string };
    pro: { label: string; priceLabel: string; seatLimit: number | null; description: string };
    addons: {
      chat: { label: string; priceLabel: string };
      recurring: { label: string; priceLabel: string };
      ai: { label: string; priceLabel: string };
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    fetch("/api/public/signup-config")
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.enabled);
        if (d.plans && d.addons) {
          setPlanInfo({
            free: d.plans.free,
            pro: d.plans.pro,
            addons: d.addons,
          });
        }
      })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    const p = searchParams.get("plan");
    if (p === "pro") setPlanTier("pro");
  }, [searchParams]);

  useEffect(() => {
    if (planTier === "free") {
      setChat(false);
      setRecurring(false);
      setAi(false);
    }
  }, [planTier]);

  useEffect(() => {
    const s = slug.trim().toLowerCase();
    if (!s || !SLUG_RE.test(s)) {
      setSlugOk(null);
      return;
    }
    const t = setTimeout(() => {
      setSlugChecking(true);
      fetch(`/api/public/slug-available?slug=${encodeURIComponent(s)}`)
        .then((r) => r.json())
        .then((d) => setSlugOk(!!d.available))
        .catch(() => setSlugOk(null))
        .finally(() => setSlugChecking(false));
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  useEffect(() => {
    setEmailVerificationToken(null);
    setOtpSent(false);
    setOtpCode("");
  }, [email]);

  const sendOtp = async () => {
    const em = email.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("Enter a valid email first");
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch("/api/public/signup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not send code");
        return;
      }
      setOtpSent(true);
      setEmailVerificationToken(null);
      toast.success("Check your inbox for a 6-digit code");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    const em = email.trim().toLowerCase();
    const code = otpCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/public/signup/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Invalid code");
        return;
      }
      if (data.emailVerificationToken) {
        setEmailVerificationToken(data.emailVerificationToken);
        toast.success("Email verified");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enabled) return;
    const proAddons = planTier === "pro";
    if (!name.trim() || !slug.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      toast.error("Please complete all fields");
      return;
    }
    const normalized = slug.trim().toLowerCase();
    if (!SLUG_RE.test(normalized)) {
      toast.error("Workspace URL: lowercase letters, numbers, and hyphens only");
      return;
    }
    if (slugOk === false) {
      toast.error("That workspace URL is taken");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!emailVerificationToken) {
      toast.error("Verify your email with the code we send you before continuing");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planTier,
          name: name.trim(),
          slug: normalized,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          emailVerificationToken,
          password,
          chatAddonEnabled: proAddons && chat,
          recurringAddonEnabled: proAddons && recurring,
          aiAddonEnabled: proAddons && ai,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Checkout failed");
        return;
      }
      if (data.redirect && data.slug) {
        toast.success("Workspace created — sign in with your email and password");
        window.location.href = data.redirect;
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error("Unexpected response from server");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-6 text-center">
        <Zap className="w-12 h-12 text-primary-400 mb-4" />
        <h1 className="text-xl font-bold text-surface-50">Self-service signup is off</h1>
        <p className="text-surface-500 mt-2 max-w-md">
          Public signup is not enabled for this deployment. Ask your administrator or use platform onboarding.
        </p>
        <Link href="/login" className="mt-8 text-primary-400 hover:text-primary-300 font-medium">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[480px] h-[480px] bg-primary-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-700 rounded-xl mb-4">
            <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-surface-50">Create your workspace</h1>
          <p className="text-surface-500 text-sm mt-1">
            Choose Free or Pro — Pro checkout is billed securely via Stripe.
          </p>
          {canceled && (
            <p className="text-amber-400/90 text-sm mt-3">Checkout was canceled — adjust options and try again.</p>
          )}
        </div>

        <div className="bg-surface-900/80 border border-surface-700/60 rounded-2xl p-7 shadow-2xl">
          <form onSubmit={handleCheckout} className="space-y-4">
            {planInfo && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlanTier("free")}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    planTier === "free"
                      ? "border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/40"
                      : "border-surface-700 bg-surface-800/40 hover:border-surface-600"
                  }`}
                >
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                    {planInfo.free.label}
                  </p>
                  <p className="text-lg font-bold text-surface-50 mt-1">{planInfo.free.priceLabel}</p>
                  <p className="text-xs text-surface-500 mt-2">{planInfo.free.description}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPlanTier("pro")}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    planTier === "pro"
                      ? "border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/40"
                      : "border-surface-700 bg-surface-800/40 hover:border-surface-600"
                  }`}
                >
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                    {planInfo.pro.label}
                  </p>
                  <p className="text-lg font-bold text-surface-50 mt-1">{planInfo.pro.priceLabel}</p>
                  <p className="text-xs text-surface-500 mt-2">{planInfo.pro.description}</p>
                </button>
              </div>
            )}

            <Input
              label="Organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<Building2 className="w-4 h-4" />}
              required
            />
            <div>
              <Input
                label="Workspace URL"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="acme-corp"
                required
              />
              <p className="text-xs text-surface-500 mt-1">
                {slugChecking ? (
                  "Checking availability…"
                ) : slugOk === true ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Available
                  </span>
                ) : slugOk === false ? (
                  <span className="text-red-400">Already taken</span>
                ) : (
                  "Lowercase letters, numbers, hyphens only"
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <div className="rounded-xl border border-surface-700 bg-surface-800/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Verify email</p>
              {emailVerificationToken ? (
                <p className="text-sm text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Email verified — you can continue
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0"
                      disabled={sendingOtp || !email.trim()}
                      onClick={() => void sendOtp()}
                    >
                      {sendingOtp ? "Sending…" : otpSent ? "Resend code" : "Send verification code"}
                    </Button>
                    {otpSent && (
                      <span className="text-xs text-surface-500 self-center">Code expires in 15 min</span>
                    )}
                  </div>
                  {otpSent && (
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                      <div className="flex-1 min-w-0">
                        <Input
                          label="6-digit code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                        />
                      </div>
                      <Button
                        type="button"
                        className="sm:mb-0.5"
                        disabled={verifyingOtp || otpCode.replace(/\D/g, "").length !== 6}
                        onClick={() => void verifyOtp()}
                      >
                        {verifyingOtp ? "Checking…" : "Verify"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <div
              className={`rounded-xl border border-surface-700 bg-surface-800/40 p-4 space-y-3 ${
                planTier === "free" ? "opacity-60" : ""
              }`}
            >
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Pro add-ons</p>
              {planTier === "free" && (
                <p className="text-xs text-surface-500">Switch to Pro to add chat, recurring tasks, and AI to your subscription.</p>
              )}
              {[
                {
                  id: "chat",
                  label: planInfo?.addons.chat.label ?? "Team chat",
                  sub: planInfo?.addons.chat.priceLabel,
                  checked: chat,
                  set: setChat,
                },
                {
                  id: "recurring",
                  label: planInfo?.addons.recurring.label ?? "Recurring tasks",
                  sub: planInfo?.addons.recurring.priceLabel,
                  checked: recurring,
                  set: setRecurring,
                },
                {
                  id: "ai",
                  label: planInfo?.addons.ai.label ?? "AI assistance",
                  sub: planInfo?.addons.ai.priceLabel,
                  checked: ai,
                  set: setAi,
                },
              ].map((o) => (
                <label key={o.id} className={`flex items-start gap-3 ${planTier === "pro" ? "cursor-pointer" : "cursor-not-allowed"}`}>
                  <input
                    type="checkbox"
                    disabled={planTier === "free"}
                    checked={o.checked}
                    onChange={(e) => o.set(e.target.checked)}
                    className="rounded border-surface-600 bg-surface-900 text-primary-500 focus:ring-primary-500 mt-0.5"
                  />
                  <span className="text-sm text-surface-200">
                    {o.label}
                    {o.sub && <span className="block text-surface-500 text-xs mt-0.5">{o.sub}</span>}
                  </span>
                </label>
              ))}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || slugOk === false || !emailVerificationToken}
            >
              {loading
                ? planTier === "free"
                  ? "Creating workspace…"
                  : "Redirecting to Stripe…"
                : planTier === "free"
                  ? "Create free workspace"
                  : "Continue to checkout"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Already have access?{" "}
            <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      }
    >
      <SignupWizard />
    </Suspense>
  );
}
