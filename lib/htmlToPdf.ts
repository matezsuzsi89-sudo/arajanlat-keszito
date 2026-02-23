/**
 * PDF generálás HTML sablonból Puppeteerrel.
 * Az adatok a sablonba kerülnek, az üres sorok szűrése a fill-template-ben történik.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
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
 * Vercel deploy-nál esetleg @sparticuz/chromium + puppeteer-core szükséges.
 */
export async function htmlToPdfBytes(html: string): Promise<Uint8Array> {
  // Dinamikus import – Puppeteer csak PDF exportnál kell
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
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
