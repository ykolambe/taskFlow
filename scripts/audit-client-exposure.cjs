/**
 * Lists NEXT_PUBLIC_* touchpoints under src/ and flags API routes that may return raw Error.message.
 * Run: npm run security:audit-client
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function walk(dir, filterRe, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === "node_modules" || name.name.startsWith(".")) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, filterRe, out);
    else if (filterRe.test(p)) out.push(p);
  }
}

const srcFiles = [];
walk(path.join(root, "src"), /\.(tsx?|jsx?)$/, srcFiles);

console.log("=== Files referencing NEXT_PUBLIC_ (inlined into client or server bundle) ===\n");
const publicHits = [];
for (const f of srcFiles) {
  const c = fs.readFileSync(f, "utf8");
  if (c.includes("NEXT_PUBLIC_")) publicHits.push(f);
}
console.log(publicHits.length ? publicHits.map((p) => path.relative(root, p)).join("\n") : "(none under src/)");
console.log("\n=== API routes: heuristic check for error responses tied to .message ===\n");

const apiFiles = [];
const apiRoot = path.join(root, "src", "app", "api");
walk(apiRoot, /route\.(tsx?|jsx?)$/, apiFiles);

const risky =
  /NextResponse\.json\s*\(\s*\{[^}]*\berror:\s*(?:e|err|error|ex)\s*(?:instanceof|\?)\s*[^}]*\.message/s;
const risky2 = /\berror:\s*(?:e|err|error)\.message\b/;

let warnings = 0;
for (const f of apiFiles) {
  const c = fs.readFileSync(f, "utf8");
  if (risky.test(c) || risky2.test(c)) {
    console.warn("Review:", path.relative(root, f));
    warnings++;
  }
}

if (warnings === 0) {
  console.log("No obvious `error: err.message` patterns in API route files.");
}

console.log("\nDone. See docs/SECURITY_CLIENT_EXPOSURE.md for interpretation.\n");
