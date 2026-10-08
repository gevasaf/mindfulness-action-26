// Renders the project's PDFs and the circle group image from their HTML sources with headless Chromium (Playwright).
//
//   design/content/teachers-call.html -> design/content/teachers-call.pdf  (the call to teachers, sent on WhatsApp)
//   site/host-kit.html + host-guide.html + sign.html -> site/assets/kit.pdf  (the circle kit with its table of
//                                                                          contents and page numbers; appendix A is the
//                                                                          circle guide, appendix B the sign)
//   tech/tools/group-image.html       -> site/assets/group-image.png        (suggested WhatsApp group photo, 640×640)
//   tech/tools/share-image.html       -> site/assets/share.jpg              (link preview image, Open Graph, 1200×630)
//   site/assets/icon.svg              -> site/assets/icons/*.png            (home-screen icons: 180, 192, 512)
//
// Run from the repo root after changing any source:  node tech/tools/make-assets.mjs
// Needs the `playwright` npm package and a Chromium it can find (PLAYWRIGHT_BROWSERS_PATH), Python with Pillow
// (the PNG) and pypdf (joining the kit and the sign), and poppler-utils (pdftotext, pdfinfo) for the page numbers.
// Pages are opened from disk; outside requests (GoatCounter) are blocked so nothing is counted.
// The PDFs are A4, light colour scheme, using the page's own print CSS.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from "node:fs";
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

const SITE = "https://gevasaf.github.io/mindfulness-action-26/";

// Footer on every kit page: the site's address and the page number (Latin only: the footer
// is drawn with system fonts). The margins come from the page's @page rule.
const footerTemplate = (num) =>
  '<div style="width:100%;padding:0 12mm;display:flex;justify-content:space-between;font-size:8.5px;color:#6b665d;font-family:sans-serif">' +
  `<span>${SITE.replace(/^https:\/\//, "").replace(/\/$/, "")}</span><span>${num}</span></div>`;
const footer = (num = '<span class="pageNumber"></span>') => ({
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: footerTemplate(num),
});

// 1. Teachers' call
await open("design/content/teachers-call.html");
await page.pdf({ path: "design/content/teachers-call.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
console.log("wrote design/content/teachers-call.pdf");

// 2. Kit: all parts open, rendered twice so the table of contents can show the page of each part
//    (found through the invisible "KITPART <id> KITEND" marks), then the circle guide (appendix A) and the
//    sign (appendix B) appended. Each appendix is rendered once first to know its page count; the final
//    renders below carry the right page numbers in their footers.
const pageCount = (f) => Number(execFileSync("pdfinfo", [f], { encoding: "utf8" }).match(/Pages:\s+(\d+)/)[1]);
// The guide and the sign have no margins of their own (@page margin 0), so they are slightly scaled
// to leave room for the same footer.
const appendixPdf = (path, num) => page.pdf({
  path, format: "A4", printBackground: true, scale: 0.96,
  margin: { top: "0", bottom: "11mm", left: "4.2mm", right: "4.2mm" },
  ...footer(num),
});
const guidePdf = join(tmp, "guide.pdf");
await open("site/host-guide.html");
await appendixPdf(guidePdf, "");
const guidePages = pageCount(guidePdf);
await open("site/host-kit.html");
await page.evaluate((site) => {
  document.title = "ערכה לפתיחת מעגל · נוֹכְחִים";
  document.querySelectorAll("details.part").forEach((d) => { d.open = true; });
  // Links to other pages point at the public site (opened from disk they would be file:// links);
  // links inside the kit (#…) stay internal, so the table of contents is clickable.
  document.querySelectorAll("a[href]").forEach((a) => {
    const h = a.getAttribute("href");
    if (!/^(#|[a-z]+:)/i.test(h)) a.setAttribute("href", site + h);
  });
}, SITE);
const kitBody = join(tmp, "kit-body.pdf");
for (let pass = 1; pass <= 2; pass++) {
  await page.pdf({ path: kitBody, format: "A4", printBackground: true, preferCSSPageSize: true, ...footer() });
  const pages = execFileSync("pdftotext", [kitBody, "-"], { encoding: "utf8" }).split("\f");
  const found = {};
  pages.forEach((text, i) => {
    for (const m of text.matchAll(/KITPART ([a-z-]+) KITEND/g)) if (!(m[1] in found)) found[m[1]] = i + 1;
  });
  found.appendix = pages.filter((t) => t.trim()).length + 1;
  found["appendix-sign"] = found.appendix + guidePages;
  await page.evaluate((found) => {
    document.querySelectorAll("[data-toc-page]").forEach((el) => {
      el.textContent = found[el.getAttribute("data-toc-page")] || "";
    });
  }, found);
}
const kitPages = pageCount(kitBody);
// Appendices with their page numbers in the footer: the guide right after the kit, then the sign.
await open("site/host-guide.html");
await appendixPdf(guidePdf, guidePages === 1 ? String(kitPages + 1) : '<span class="pageNumber"></span>');
await open("site/sign.html");
const signPdf = join(tmp, "sign.pdf");
await appendixPdf(signPdf, String(kitPages + guidePages + 1));
// Merge with pypdf, which keeps the kit's internal links (pdfunite drops them).
execFileSync("python3", ["-c", "import sys;from pypdf import PdfWriter;w=PdfWriter();[w.append(f) for f in sys.argv[1:-1]];w.write(sys.argv[-1])", kitBody, guidePdf, signPdf, "site/assets/kit.pdf"]);
console.log("wrote site/assets/kit.pdf");

// 3. Group image
await open("tech/tools/group-image.html");
await page.setViewportSize({ width: 640, height: 640 });
await page.screenshot({ path: "site/assets/group-image.png" });
// Shrink: the image is flat colours, so a 32-colour palette PNG looks the same at a fraction of the size.
execFileSync("python3", ["-c", "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB').quantize(32);im.save(sys.argv[1],optimize=True)", "site/assets/group-image.png"]);
console.log("wrote site/assets/group-image.png");

// 4. Link preview image (Open Graph), JPEG because of the photo behind it
await open("tech/tools/share-image.html");
await page.setViewportSize({ width: 1200, height: 630 });
await page.screenshot({ path: "site/assets/share.jpg", type: "jpeg", quality: 82 });
console.log("wrote site/assets/share.jpg");

// 5. Home-screen icons (web app manifest and iOS): the site icon on the page colour, full bleed, with the
//    circle inside the central safe zone so the same image works as a "maskable" icon.
mkdirSync("site/assets/icons", { recursive: true });
const iconSvg = readFileSync("site/assets/icon.svg", "utf8");
for (const [size, name] of [[180, "apple-touch-icon.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;background:#f7f3ec;display:grid;place-items:center">` +
    iconSvg.replace("<svg ", `<svg width="${Math.round(size * 0.66)}" height="${Math.round(size * 0.66)}" `) + "</body>");
  await page.screenshot({ path: `site/assets/icons/${name}` });
  console.log(`wrote site/assets/icons/${name}`);
}

await browser.close();
rmSync(tmp, { recursive: true, force: true });
