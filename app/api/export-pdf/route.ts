import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { formSchema } from "@/lib/schema";
import { generateQuoteHtml, getContrastTextColor } from "@/templates/fill-template";
import type { FormData } from "@/lib/schema";

function escapeForHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFooterTemplate(data: FormData): string {
  const { company } = data;
  const design = data.pdfDesign ?? {};
  const accentColor = escapeForHtml(design.accentColor ?? "#2563eb");
  const accentTextColor = getContrastTextColor(design.accentColor ?? "#2563eb");
  const date = escapeForHtml(new Date().toLocaleDateString("hu-HU"));
  const contactParts: string[] = [];
  if (company.phone?.trim())
    contactParts.push(`Tel: ${escapeForHtml(company.phone)}`);
  if (company.email?.trim())
    contactParts.push(`E-mail: ${escapeForHtml(company.email)}`);
  const footerContact = contactParts.join("  |  ");
  return `<div style="width: 100%; box-sizing: border-box; font-size: 9pt; padding: 10px 20px; background: ${accentColor}; color: ${accentTextColor}; display: flex; justify-content: space-between; align-items: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: hidden;">
  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%;">${footerContact}</span>
  <span style="flex-shrink: 0;">${date}</span>
</div>`;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = formSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Érvénytelen adatok", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data as FormData;

    const templatePath = join(process.cwd(), "templates", "quote.html");
    const templateHtml = readFileSync(templatePath, "utf-8");
    const html = generateQuoteHtml(data, templateHtml);

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
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: buildFooterTemplate(data),
        margin: { top: "15mm", right: "0", bottom: "15mm", left: "0" },
      });
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="arajánlat.pdf"`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[export-pdf]", err);
    const msg = err instanceof Error ? err.message : "PDF generálás sikertelen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
