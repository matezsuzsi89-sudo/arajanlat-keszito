import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { formSchema } from "@/lib/schema";
import { exportQuoteToPdfBytes } from "@/lib/htmlToPdf";
import { exportToPdfBytes } from "@/lib/pdfExport";
import type { FormData } from "@/lib/schema";

export const maxDuration = 60;

function loadFontBytes(): { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array } | null {
  const dir = join(process.cwd(), "public", "fonts");
  const files = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans-Italic.ttf"] as const;
  const paths = files.map((f) => join(dir, f));
  if (!paths.every((p) => existsSync(p))) return null;
  return {
    regular: new Uint8Array(readFileSync(paths[0])),
    bold: new Uint8Array(readFileSync(paths[1])),
    italic: new Uint8Array(readFileSync(paths[2])),
  };
}

function safeFilename(client: FormData["client"], offerId?: string): string {
  const displayName =
    client?.kind === "company"
      ? client.companyName ?? ""
      : client?.kind === "individual"
        ? client.personName ?? ""
        : (client as { name?: string } | undefined)?.name ?? "";
  const safe = (displayName || "ajanlat")
    .replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "ajanlat";
  return offerId ? `${offerId}_${safe}.pdf` : `arajánlat-${new Date().toISOString().slice(0, 10)}.pdf`;
}

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
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined;
    const fontBytes = loadFontBytes();

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await exportQuoteToPdfBytes(data);
    } catch (puppeteerErr) {
      // Vercel: libnss3.so hiányzik → fallback pdf-lib-re
      console.warn("[export-pdf] Puppeteer failed, using pdf-lib fallback:", puppeteerErr);
      pdfBytes = await exportToPdfBytes(data, baseUrl, fontBytes ?? undefined);
    }
    const filename = safeFilename(data.client, data.offerId);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[export-pdf]", err);
    const msg = err instanceof Error ? err.message : "PDF generálás sikertelen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
