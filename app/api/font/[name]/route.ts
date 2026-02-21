import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const FONT_ENTRIES: Record<
  string,
  { woff2: string; ttf: string; type: string }
> = {
  "NotoSans-Regular": {
    woff2: "noto-sans-latin-ext-400-normal.woff2",
    ttf: "NotoSans-Regular.ttf",
    type: "font/woff2",
  },
  "NotoSans-Bold": {
    woff2: "noto-sans-latin-ext-700-normal.woff2",
    ttf: "NotoSans-Bold.ttf",
    type: "font/woff2",
  },
  "NotoSans-Italic": {
    woff2: "noto-sans-latin-ext-400-italic.woff2",
    ttf: "NotoSans-Italic.ttf",
    type: "font/woff2",
  },
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await context.params;
    const entry = FONT_ENTRIES[name];
    if (!entry) {
      return NextResponse.json({ error: "Unknown font" }, { status: 404 });
    }
    const woff2Path = join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "noto-sans",
      "files",
      entry.woff2
    );
    const ttfPath = join(process.cwd(), "public", "fonts", entry.ttf);

    let buffer: Buffer;
    let contentType = entry.type;

    if (existsSync(woff2Path)) {
      buffer = readFileSync(woff2Path);
    } else if (existsSync(ttfPath)) {
      buffer = readFileSync(ttfPath);
      contentType = "font/ttf";
    } else {
      const cdnUrl = `https://unpkg.com/@fontsource/noto-sans@5.2.10/files/${entry.woff2}`;
      try {
        const res = await fetch(cdnUrl);
        if (!res.ok) throw new Error(`CDN ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } catch {
        return NextResponse.json(
          {
            error: "Font not found",
            hint: `Add ${entry.ttf} to public/fonts/ or reinstall @fontsource/noto-sans`,
          },
          { status: 404 }
        );
      }
    }
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[font-api]", err);
    return NextResponse.json({ error: "Font load failed" }, { status: 500 });
  }
}
