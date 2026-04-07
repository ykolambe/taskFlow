# TaskFlow on mobile (Android and iOS)

This document records the **distribution decision** for TaskFlow and how to ship **installable web (PWA)** and optional **store binaries (Capacitor)** without rewriting the Next.js app.

## Decision (summary)

| Approach | Use when |
|----------|----------|
| **PWA** (“Add to Home Screen”) | Fastest path; no app stores; single deploy updates all users. |
| **Capacitor** (`android/`, `ios/`) | You need **Google Play** and/or **App Store** listings while keeping one web codebase. |
| **TWA** (Android only) | Play Store with Chrome-centric PWA; not covered by repo scripts—see [TWA docs](https://developer.chrome.com/docs/android/trusted-web-activity/). |
| **React Native / Expo** | Only if you plan a full native UI rewrite; not part of this repo. |

**Chosen default for this project:** ship **PWA first** for all users; use **Capacitor** as an optional shell for store distribution pointing at your **production HTTPS** URL.

---

## PWA checklist (production)

1. **HTTPS** — Install prompts and service workers require a secure origin (or `localhost` for dev).
2. **Host alignment** — Set `ROOT_DOMAIN`, `NEXT_PUBLIC_APP_URL`, and open the app using the same host users will bookmark (affects cookies and middleware).
3. **Tenant install** — For workspace-scoped install, open a tenant URL (e.g. `/t/your-slug/login`) so the browser uses `GET /t/{slug}/manifest` (`src/app/t/[slug]/manifest/route.ts`) for `scope` + `start_url` for that workspace.
4. **Platform install** — For platform admin flows, `/platform/login` uses the root manifest (`src/app/manifest.ts`).
5. **Service worker** — `public/sw.js` must not cache authenticated HTML/API routes (already avoided for `/t/*`, `/platform/*`, `/api/*`).

---

## Capacitor (store shells)

The repo includes Capacitor config at the project root. Native projects live in `android/` and `ios/` after you run `npx cap add`.

### Configuration

- **`CAPACITOR_SERVER_URL`** — Full origin of your deployed app, e.g. `https://app.example.com`. The WebView loads this URL; cookies apply to that origin (same as the browser).
- Falls back to **`NEXT_PUBLIC_APP_URL`** if `CAPACITOR_SERVER_URL` is unset.

See `.env.example` in the repo root for variable names.

### Commands

```bash
npm install
npm run cap:sync
npm run cap:open:android   # Android Studio
npm run cap:open:ios       # Xcode (macOS only)
```

After changing plugins or `capacitor.config.ts`, run `npm run cap:sync` again.

### iOS note

`npx cap add ios` must be run on **macOS** with Xcode. CI/Linux can build Android only.

---

## Auth and WebView / standalone testing

TaskFlow uses **httpOnly cookies** for sessions (`platform_token`, tenant tokens). Validate the following in each shell you care about:

### PWA (Safari / Chrome)

1. Log in on HTTPS.
2. Add to Home Screen, launch from icon.
3. Confirm you remain logged in after closing and reopening the PWA (same origin).

### Capacitor WebView

1. Set `CAPACITOR_SERVER_URL` to your **HTTPS** production URL.
2. Build/run the app from Android Studio or Xcode.
3. Log in; put app in background and resume; confirm session persists.
4. If login fails only in WebView, verify the URL is **exactly** your cookie domain (no mixed `www` vs apex), and that you are not using `http://` against production (use HTTPS or set `cleartext` only for dev).

### Manual test matrix (tick when done)

| Environment | Platform login `/platform/login` | Tenant login `/t/{slug}/login` |
|-------------|----------------------------------|--------------------------------|
| Mobile browser | | |
| PWA (installed) | | |
| Capacitor Android | | |
| Capacitor iOS | | |

---

## References

- Root manifest: `src/app/manifest.ts`
- Tenant manifest API: `src/app/t/[slug]/manifest/route.ts`
- Service worker: `public/sw.js`
- Capacitor config: `capacitor.config.ts` (repo root)
