import { NextResponse } from "next/server";
import { formSchema } from "@/lib/schema";
import { exportToPdfBytes } from "@/lib/pdfExport";
import type { FormData } from "@/lib/schema";

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

    const pdfBytes = await exportToPdfBytes(data);
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
