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
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
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
  const html = generateQuoteHtml(data, templateHtml);
  return htmlToPdfBytes(html);
}
