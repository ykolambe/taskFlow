/**
 * Rasterize branded splash SVGs for Capacitor iOS / Android.
 * Run: npm run native:splash
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");

/** Matches dark theme surface-950 (#090d17) */
const BG = "#090d17";

function svgPortrait() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
    <radialGradient id="glowTop" cx="28%" cy="16%" r="55%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBot" cx="72%" cy="88%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="28" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1080" height="1920" fill="${BG}"/>
  <rect width="1080" height="1920" fill="url(#glowTop)"/>
  <rect width="1080" height="1920" fill="url(#glowBot)"/>
  <g filter="url(#soft)">
    <rect x="390" y="688" width="300" height="300" rx="68" fill="url(#brand)" opacity="0.95"/>
    <text x="540" y="870" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="112" font-weight="800" letter-spacing="-0.06em">TF</text>
  </g>
  <text x="540" y="1120" text-anchor="middle" fill="#f1f5f9" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="56" font-weight="800" letter-spacing="-0.04em">TaskFlow</text>
  <text x="540" y="1185" text-anchor="middle" fill="#a78bfa" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" letter-spacing="0.32em">MULTI-TENANT TASKS</text>
</svg>`;
}

function svgLandscape() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="brandL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
    <radialGradient id="glowTopL" cx="22%" cy="22%" r="55%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBotL" cx="82%" cy="78%" r="48%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softL" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="22" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="${BG}"/>
  <rect width="1920" height="1080" fill="url(#glowTopL)"/>
  <rect width="1920" height="1080" fill="url(#glowBotL)"/>
  <g filter="url(#softL)">
    <rect x="810" y="300" width="300" height="300" rx="68" fill="url(#brandL)" opacity="0.95"/>
    <text x="960" y="482" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="112" font-weight="800" letter-spacing="-0.06em">TF</text>
  </g>
  <text x="960" y="720" text-anchor="middle" fill="#f1f5f9" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="52" font-weight="800" letter-spacing="-0.04em">TaskFlow</text>
  <text x="960" y="780" text-anchor="middle" fill="#a78bfa" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" letter-spacing="0.3em">MULTI-TENANT TASKS</text>
</svg>`;
}

function svgSquare() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="brandS" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
    <radialGradient id="glowTopS" cx="30%" cy="25%" r="55%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBotS" cx="70%" cy="75%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softS" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="36" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="2732" height="2732" fill="${BG}"/>
  <rect width="2732" height="2732" fill="url(#glowTopS)"/>
  <rect width="2732" height="2732" fill="url(#glowBotS)"/>
  <g filter="url(#softS)">
    <rect x="1216" y="1088" width="300" height="300" rx="68" fill="url(#brandS)" opacity="0.95"/>
    <text x="1366" y="1270" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="112" font-weight="800" letter-spacing="-0.06em">TF</text>
  </g>
  <text x="1366" y="1520" text-anchor="middle" fill="#f1f5f9" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="64" font-weight="800" letter-spacing="-0.04em">TaskFlow</text>
  <text x="1366" y="1595" text-anchor="middle" fill="#a78bfa" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" letter-spacing="0.32em">MULTI-TENANT TASKS</text>
</svg>`;
}

const androidTargets = [
  { dir: "drawable", file: "splash.png", w: 480, h: 320, landscape: true },
  { dir: "drawable-port-mdpi", file: "splash.png", w: 320, h: 480, landscape: false },
  { dir: "drawable-port-hdpi", file: "splash.png", w: 480, h: 800, landscape: false },
  { dir: "drawable-port-xhdpi", file: "splash.png", w: 720, h: 1280, landscape: false },
  { dir: "drawable-port-xxhdpi", file: "splash.png", w: 960, h: 1600, landscape: false },
  { dir: "drawable-port-xxxhdpi", file: "splash.png", w: 1280, h: 1920, landscape: false },
  { dir: "drawable-land-mdpi", file: "splash.png", w: 480, h: 320, landscape: true },
  { dir: "drawable-land-hdpi", file: "splash.png", w: 800, h: 480, landscape: true },
  { dir: "drawable-land-xhdpi", file: "splash.png", w: 1280, h: 720, landscape: true },
  { dir: "drawable-land-xxhdpi", file: "splash.png", w: 1600, h: 960, landscape: true },
  { dir: "drawable-land-xxxhdpi", file: "splash.png", w: 1920, h: 1280, landscape: true },
];

async function main() {
  const portraitBuf = Buffer.from(svgPortrait());
  const landscapeBuf = Buffer.from(svgLandscape());
  const squareBuf = Buffer.from(svgSquare());

  const iosDir = path.join(root, "ios", "App", "App", "Assets.xcassets", "Splash.imageset");
  const iosName = "splash-2732x2732.png";
  await sharp(squareBuf).png({ compressionLevel: 9 }).toFile(path.join(iosDir, iosName));
  await sharp(squareBuf).png({ compressionLevel: 9 }).toFile(path.join(iosDir, "splash-2732x2732-1.png"));
  await sharp(squareBuf).png({ compressionLevel: 9 }).toFile(path.join(iosDir, "splash-2732x2732-2.png"));

  const contentsPath = path.join(iosDir, "Contents.json");
  const contents = JSON.parse(fs.readFileSync(contentsPath, "utf8"));
  for (const img of contents.images) {
    img.filename = iosName;
  }
  fs.writeFileSync(contentsPath, JSON.stringify(contents, null, 2) + "\n");

  const androidRes = path.join(root, "android", "app", "src", "main", "res");
  for (const t of androidTargets) {
    const input = t.landscape ? landscapeBuf : portraitBuf;
    const out = path.join(androidRes, t.dir, t.file);
    await sharp(input).resize(t.w, t.h, { fit: "fill" }).png({ compressionLevel: 9 }).toFile(out);
  }

  console.log("Wrote iOS Splash.imageset and Android res/drawable* splash.png assets.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
