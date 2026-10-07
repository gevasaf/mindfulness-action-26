// Renders the project's PDFs and the circle group image from their HTML sources with headless Chromium (Playwright).
//
//   design/content/teachers-call.html -> design/content/teachers-call.pdf  (the call to teachers, sent on WhatsApp)
//   site/host-kit.html + site/sign.html -> site/assets/kit.pdf            (the circle kit with its table of contents,
//                                                                          page numbers, and the sign as an appendix)
//   tech/tools/group-image.html       -> site/assets/group-image.png        (suggested WhatsApp group photo, 640×640)
//
// Run from the repo root after changing any source:  node tech/tools/make-assets.mjs
// Needs the `playwright` npm package and a Chromium it can find (PLAYWRIGHT_BROWSERS_PATH), Python with Pillow
// for the PNG, and poppler-utils (pdftotext, pdfunite) for the kit's page numbers and appendix.
// Pages are opened from disk; outside requests (GoatCounter) are blocked so nothing is counted.
// The PDFs are A4, light colour scheme, using the page's own print CSS.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// require() so a globally installed playwright is found through NODE_PATH too
const { chromium } = createRequire(import.meta.url)("playwright");

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "light" });
await page.route(/^https?:/, (route) => route.abort());
const tmp = mkdtempSync(join(tmpdir(), "make-assets-"));

async function open(src) {
  await page.goto(pathToFileURL(resolve(src)).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
}

// Page number in the footer; the margins come from the page's @page rule.
const footer = {
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#6b665d;font-family:sans-serif"><span class="pageNumber"></span></div>',
};

// 1. Teachers' call
await open("design/content/teachers-call.html");
await page.pdf({ path: "design/content/teachers-call.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
console.log("wrote design/content/teachers-call.pdf");

// 2. Kit: all parts open, rendered twice so the table of contents can show the page of each part
//    (found through the invisible "KITPART <id> KITEND" marks), then the sign appended as the last page.
await open("site/host-kit.html");
await page.evaluate(() => {
  document.title = "ערכה לפתיחת מעגל · נוֹכְחִים";
  document.querySelectorAll("details.part").forEach((d) => { d.open = true; });
});
const kitBody = join(tmp, "kit-body.pdf");
for (let pass = 1; pass <= 2; pass++) {
  await page.pdf({ path: kitBody, format: "A4", printBackground: true, preferCSSPageSize: true, ...footer });
  const pages = execFileSync("pdftotext", [kitBody, "-"], { encoding: "utf8" }).split("\f");
  const found = {};
  pages.forEach((text, i) => {
    for (const m of text.matchAll(/KITPART ([a-z-]+) KITEND/g)) if (!(m[1] in found)) found[m[1]] = i + 1;
  });
  found.appendix = pages.filter((t) => t.trim()).length + 1;
  await page.evaluate((found) => {
    document.querySelectorAll("[data-toc-page]").forEach((el) => {
      el.textContent = found[el.getAttribute("data-toc-page")] || "";
    });
  }, found);
}
await open("site/sign.html");
const signPdf = join(tmp, "sign.pdf");
await page.pdf({ path: signPdf, format: "A4", printBackground: true, preferCSSPageSize: true });
execFileSync("pdfunite", [kitBody, signPdf, "site/assets/kit.pdf"]);
console.log("wrote site/assets/kit.pdf");

// 3. Group image
await open("tech/tools/group-image.html");
await page.setViewportSize({ width: 640, height: 640 });
await page.screenshot({ path: "site/assets/group-image.png" });
// Shrink: the image is flat colours, so a 32-colour palette PNG looks the same at a fraction of the size.
execFileSync("python3", ["-c", "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB').quantize(32);im.save(sys.argv[1],optimize=True)", "site/assets/group-image.png"]);
console.log("wrote site/assets/group-image.png");

await browser.close();
rmSync(tmp, { recursive: true, force: true });
