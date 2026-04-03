"use client";

import { useState, useRef, useEffect } from "react";
import type { UiFontScale, UiTheme } from "@prisma/client";
import {
  Camera,
  Save,
  Key,
  Eye,
  EyeOff,
  User,
  Mail,
  AtSign,
  Shield,
  Phone,
  FileText,
  Palette,
  Sun,
  Moon,
  Type,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { TenantTokenPayload } from "@/lib/auth";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import PushNotificationSettings from "@/components/tenant/PushNotificationSettings";
import {
  TENANT_LIGHT_BRIGHTNESS_KEY,
  LIGHT_BRIGHTNESS_MIN,
  LIGHT_BRIGHTNESS_MAX,
  LIGHT_BRIGHTNESS_DEFAULT,
} from "@/components/layout/TenantLightBrightness";

interface Props {
  user: TenantTokenPayload;
  slug: string;
  initialData: {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    phone: string | null;
    roleLevel: { name: string; color: string; level: number };
    isSuperAdmin: boolean;
    uiTheme: UiTheme;
    uiFontScale: UiFontScale;
  };
}

export default function ProfilePage({ user, slug, initialData }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [firstName, setFirstName] = useState(initialData.firstName);
  const [lastName, setLastName] = useState(initialData.lastName);
  const [bio, setBio] = useState(initialData.bio ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [uiTheme, setUiTheme] = useState<UiTheme>(initialData.uiTheme);
  const [uiFontScale, setUiFontScale] = useState<UiFontScale>(initialData.uiFontScale);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [lightBrightness, setLightBrightness] = useState(LIGHT_BRIGHTNESS_DEFAULT);

  useEffect(() => {
    setUiTheme(initialData.uiTheme);
    setUiFontScale(initialData.uiFontScale);
  }, [initialData.uiTheme, initialData.uiFontScale]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TENANT_LIGHT_BRIGHTNESS_KEY);
      if (raw != null) {
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n)) setLightBrightness(Math.min(LIGHT_BRIGHTNESS_MAX, Math.max(LIGHT_BRIGHTNESS_MIN, n)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLightBrightnessPersist = (value: number) => {
    const v = Math.min(LIGHT_BRIGHTNESS_MAX, Math.max(LIGHT_BRIGHTNESS_MIN, value));
    setLightBrightness(v);
    try {
      localStorage.setItem(TENANT_LIGHT_BRIGHTNESS_KEY, String(v));
      window.dispatchEvent(new Event("tenant-light-brightness-change"));
    } catch {
      /* ignore */
    }
  };

  const saveAppearance = async (patch: Partial<{ uiTheme: UiTheme; uiFontScale: UiFontScale }>) => {
    setSavingAppearance(true);
    try {
      const res = await fetch(`/api/t/${slug}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error("Could not save appearance");
        return;
      }
      if (patch.uiTheme !== undefined) setUiTheme(patch.uiTheme);
      if (patch.uiFontScale !== undefined) setUiFontScale(patch.uiFontScale);
      toast.success("Appearance updated");
      router.refresh();
    } finally {
      setSavingAppearance(false);
    }
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/upload?type=avatar&slug=${encodeURIComponent(slug)}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed"); return; }

      const saveRes = await fetch(`/api/t/${slug}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: data.url }),
      });
      if (!saveRes.ok) { toast.error("Failed to save avatar"); return; }

      setAvatarUrl(data.url);
      toast.success("Avatar updated!");
      router.refresh();
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Save profile ───────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/t/${slug}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, bio, phone }),
      });
      if (!res.ok) { toast.error("Failed to save"); return; }
      toast.success("Profile updated!");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/t/${slug}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success("Password changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
          <User className="w-5 h-5 text-primary-500 dark:text-primary-400" />
          My Profile
        </h1>
        <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
          Manage your account details, appearance, and password
        </p>
      </div>

      {/* Appearance */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary-500 dark:text-primary-400" />
          Appearance
        </h2>
        <p className="text-xs text-surface-500 dark:text-surface-500">
          Theme and text size apply across this workspace on all your devices.
        </p>

        <div className="space-y-2">
          <span className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 opacity-80" /> Theme
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={savingAppearance}
              onClick={() => saveAppearance({ uiTheme: "LIGHT" })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                uiTheme === "LIGHT"
                  ? "border-primary-500 bg-primary-500/15 text-primary-800 dark:text-primary-200"
                  : "border-surface-600/80 bg-surface-750/50 text-surface-600 hover:bg-surface-700/50 dark:border-surface-600 dark:text-surface-400"
              )}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button
              type="button"
              disabled={savingAppearance}
              onClick={() => saveAppearance({ uiTheme: "DARK" })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                uiTheme === "DARK"
                  ? "border-primary-500 bg-primary-500/15 text-primary-800 dark:text-primary-200"
                  : "border-surface-600/80 bg-surface-750/50 text-surface-600 hover:bg-surface-700/50 dark:border-surface-600 dark:text-surface-400"
              )}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
          </div>
        </div>

        {uiTheme === "LIGHT" && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 opacity-80" /> Light mode brightness
            </span>
            <p className="text-[11px] text-surface-500 dark:text-surface-500">
              Softer lowers background glare; brighter lifts page and panel backgrounds. Saved on this browser only.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-surface-500 w-12 shrink-0">Softer</span>
              <input
                type="range"
                min={LIGHT_BRIGHTNESS_MIN}
                max={LIGHT_BRIGHTNESS_MAX}
                step={1}
                value={lightBrightness}
                onChange={(e) => setLightBrightnessPersist(parseInt(e.target.value, 10))}
                className="flex-1 h-2 accent-primary-600 rounded-lg appearance-none bg-surface-700/50"
                aria-label="Light theme brightness"
              />
              <span className="text-[10px] text-surface-500 w-12 text-right shrink-0">Brighter</span>
            </div>
            <p className="text-[11px] text-surface-500 tabular-nums">{lightBrightness}%</p>
          </div>
        )}

        <div className="space-y-2">
          <span className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 opacity-80" /> Text size
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ["SMALL", "Small"],
                ["MEDIUM", "Medium"],
                ["LARGE", "Large"],
                ["XL", "Extra large"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={savingAppearance}
                onClick={() => saveAppearance({ uiFontScale: value })}
                className={cn(
                  "rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm",
                  uiFontScale === value
                    ? "border-primary-500 bg-primary-500/15 text-primary-800 dark:text-primary-200"
                    : "border-surface-600/80 bg-surface-750/50 text-surface-600 hover:bg-surface-700/50 dark:border-surface-600 dark:text-surface-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Notifications</h2>
        <PushNotificationSettings slug={slug} />
      </div>

      {/* Avatar section */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Profile Picture</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar
              firstName={firstName}
              lastName={lastName}
              avatarUrl={avatarUrl}
              size="xl"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className={cn(
                "absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary-500 hover:bg-primary-400",
                "flex items-center justify-center transition-all shadow-lg",
                avatarUploading && "opacity-50 cursor-wait"
              )}
              title="Change photo"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              {firstName} {lastName}
            </p>
            <div
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mt-1.5"
              style={{
                backgroundColor: initialData.roleLevel.color + "20",
                color: initialData.roleLevel.color,
                border: `1px solid ${initialData.roleLevel.color}40`,
              }}
            >
              {initialData.roleLevel.name}
              {initialData.isSuperAdmin && <Shield className="w-3 h-3" />}
            </div>
            <p className="text-[11px] text-surface-500 dark:text-surface-500 mt-1">
              JPEG, PNG, GIF or WebP · max 3 MB
            </p>
            {avatarUrl && (
              <button
                onClick={async () => {
                  const res = await fetch(`/api/t/${slug}/me`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ avatarUrl: null }),
                  });
                  if (res.ok) { setAvatarUrl(null); toast.success("Avatar removed"); router.refresh(); }
                }}
                className="text-[11px] text-red-400 hover:text-red-300 mt-1 transition-colors block"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Personal Information</h2>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            leftIcon={<User className="w-3.5 h-3.5" />}
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <Input
          label="Phone"
          type="tel"
          placeholder="e.g. +1 555 000 1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          leftIcon={<Phone className="w-3.5 h-3.5" />}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-surface-500" /> Bio
          </label>
          <Textarea
            placeholder="A short description about yourself…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
          />
          <p className="text-[10px] text-surface-600 text-right">{bio.length}/300</p>
        </div>

        {/* Read-only fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-600 dark:text-surface-300">Email</label>
            <div className="flex items-center gap-2 bg-surface-750 border border-surface-600 rounded-xl px-4 py-2.5">
              <Mail className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <span className="text-sm text-surface-600 dark:text-surface-400 truncate">{initialData.email}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-600 dark:text-surface-300">Username</label>
            <div className="flex items-center gap-2 bg-surface-750 border border-surface-600 rounded-xl px-4 py-2.5">
              <AtSign className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <span className="text-sm text-surface-600 dark:text-surface-400 truncate">{initialData.username}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={handleSaveProfile} loading={savingProfile} size="sm">
            <Save className="w-3.5 h-3.5 mr-1" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <Key className="w-4 h-4 text-surface-500 dark:text-surface-400" /> Change Password
        </h2>

        <Input
          label="Current Password"
          type={showCurrent ? "text" : "password"}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          rightIcon={
            <button onClick={() => setShowCurrent((s) => !s)} className="text-surface-400 hover:text-surface-200 transition-colors">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="New Password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            rightIcon={
              <button onClick={() => setShowNew((s) => !s)} className="text-surface-400 hover:text-surface-200 transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword && newPassword !== confirmPassword ? "Passwords don't match" : undefined}
          />
        </div>

        {newPassword && (
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: "8+ chars", ok: newPassword.length >= 8 },
              { label: "uppercase", ok: /[A-Z]/.test(newPassword) },
              { label: "number", ok: /\d/.test(newPassword) },
            ].map(({ label, ok }) => (
              <span
                key={label}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium",
                  ok ? "bg-emerald-500/20 text-emerald-400" : "bg-surface-700 text-surface-500"
                )}
              >
                {ok ? "✓" : "·"} {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleChangePassword}
            loading={savingPassword}
            size="sm"
            variant="secondary"
          >
            <Key className="w-3.5 h-3.5 mr-1" /> Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
