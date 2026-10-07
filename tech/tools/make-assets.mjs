// Renders the project's PDFs and the circle group image from their HTML sources with headless Chromium (Playwright).
//
//   design/content/teachers-call.html -> design/content/teachers-call.pdf  (the call to teachers, sent on WhatsApp)
//   site/host-kit.html                -> site/assets/kit.pdf                (the circle kit, downloadable from that page)
//   tech/tools/group-image.html       -> site/assets/group-image.png        (suggested WhatsApp group photo, 640×640)
//
// Run from the repo root after changing either source:  node tech/tools/make-assets.mjs
// Needs the `playwright` npm package and a Chromium it can find (PLAYWRIGHT_BROWSERS_PATH), and Python with Pillow for the PNG.
// Pages are opened from disk; outside requests (GoatCounter) are blocked so nothing is counted.
// The PDFs are A4, light colour scheme, using the page's own print CSS.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

// require() so a globally installed playwright is found through NODE_PATH too
const { chromium } = createRequire(import.meta.url)("playwright");

const jobs = [
  { src: "design/content/teachers-call.html", out: "design/content/teachers-call.pdf" },
  { src: "site/host-kit.html", out: "site/assets/kit.pdf", title: "ערכה לפתיחת מעגל · נוֹכְחִים" },
  { src: "tech/tools/group-image.html", out: "site/assets/group-image.png", png: { width: 640, height: 640 }, quantize: true },
];

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "light" });
await page.route(/^https?:/, (route) => route.abort());
for (const job of jobs) {
  await page.goto(pathToFileURL(resolve(job.src)).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  if (job.title) await page.evaluate((t) => { document.title = t; }, job.title);
  if (job.png) {
    await page.setViewportSize(job.png);
    await page.screenshot({ path: job.out });
    // Shrink: the image is flat colours, so a 32-colour palette PNG looks the same at a fraction of the size.
    if (job.quantize) execFileSync("python3", ["-c", "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB').quantize(32);im.save(sys.argv[1],optimize=True)", job.out]);
  } else {
    await page.pdf({ path: job.out, format: "A4", printBackground: true, preferCSSPageSize: true });
  }
  console.log("wrote", job.out);
}
await browser.close();
