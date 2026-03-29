/**
 * Rasterize public/icon.svg to PNG sizes used by the Web App Manifest.
 * Run: npm run pwa:icons
 */
const sharp = require("sharp");
const path = require("path");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "icon.svg");

async function main() {
  await sharp(svgPath).resize(192, 192).png().toFile(path.join(root, "public", "icon-192.png"));
  await sharp(svgPath).resize(512, 512).png().toFile(path.join(root, "public", "icon-512.png"));
  console.log("Wrote public/icon-192.png and public/icon-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
