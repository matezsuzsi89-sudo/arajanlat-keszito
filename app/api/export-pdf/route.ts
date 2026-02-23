import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { formSchema } from "@/lib/schema";
import { exportToPdfBytes } from "@/lib/pdfExport";
import type { FormData } from "@/lib/schema";

function loadFontBytes(): { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array } | null {
  const dir = join(process.cwd(), "public", "fonts");
  const files = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans-Italic.ttf"] as const;
  const [r, b, i] = files.map((f) => join(dir, f));
  if (!existsSync(r) || !existsSync(b) || !existsSync(i)) return null;
  return {
    regular: new Uint8Array(readFileSync(r)),
    bold: new Uint8Array(readFileSync(b)),
    italic: new Uint8Array(readFileSync(i)),
  };
}

export const maxDuration = 60;

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

    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : request.headers.get("origin") || "http://localhost:3000";
    const fontBytes = loadFontBytes();
    const pdfBytes = await exportToPdfBytes(data, baseUrl, fontBytes ?? undefined);
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
