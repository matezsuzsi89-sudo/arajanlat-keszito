/**
 * PDF generálás HTML sablonból Puppeteerrel.
 * Az adatok a sablonba kerülnek, az üres sorok szűrése a fill-template-ben történik.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chromium from "@sparticuz/chromium";
import type { FormData } from "./schema";
import { generateQuoteHtml } from "@/templates/fill-template";

async function loadTemplate(): Promise<string> {
  const p = join(process.cwd(), "templates", "quote.html");
  if (!existsSync(p)) {
    throw new Error("Hiányzó sablon: templates/quote.html");
  }
  return readFileSync(p, "utf-8");
}

function loadEmbeddedFontCss(): string {
  const dir = join(process.cwd(), "public", "fonts");
  const files = [
    { file: "NotoSans-Regular.ttf", weight: "400", style: "normal" },
    { file: "NotoSans-Bold.ttf", weight: "700", style: "normal" },
    { file: "NotoSans-Italic.ttf", weight: "400", style: "italic" },
  ] as const;
  const rules: string[] = [];
  for (const { file, weight, style } of files) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    const buf = readFileSync(path);
    const base64 = Buffer.from(buf).toString("base64");
    rules.push(
      `@font-face{font-family:'Noto Sans';font-weight:${weight};font-style:${style};src:url(data:font/ttf;base64,${base64}) format('truetype');}`
    );
  }
  return rules.length > 0 ? `<style>${rules.join("")}</style>` : "";
}

/**
 * HTML string-ből PDF byte array Puppeteerrel.
 * @sparticuz/chromium + puppeteer-core – Vercel serverless kompatibilis.
 */
export async function htmlToPdfBytes(html: string): Promise<Uint8Array> {
  const puppeteer = await import("puppeteer-core");

  const browser = await puppeteer.default.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 150));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * FormData-ból PDF byte array generálása HTML sablonnal.
 */
export async function exportQuoteToPdfBytes(data: FormData): Promise<Uint8Array> {
  const templateHtml = await loadTemplate();
  let html = generateQuoteHtml(data, templateHtml);
  const fontCss = loadEmbeddedFontCss();
  html = html.replace("{{EMBEDDED_FONT_CSS}}", fontCss);
  return htmlToPdfBytes(html);
}
