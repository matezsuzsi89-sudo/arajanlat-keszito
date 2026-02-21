import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/** TTF URLs for PDF embedding (woff2 is unreliable in pdf-lib) */
const TTF_CDN = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans";

const FONT_ENTRIES: Record<
  string,
  { woff2: string; ttf: string; ttfUrl: string; type: string }
> = {
  "NotoSans-Regular": {
    woff2: "noto-sans-latin-ext-400-normal.woff2",
    ttf: "NotoSans-Regular.ttf",
    ttfUrl: `${TTF_CDN}/NotoSans-Regular.ttf`,
    type: "font/woff2",
  },
  "NotoSans-Bold": {
    woff2: "noto-sans-latin-ext-700-normal.woff2",
    ttf: "NotoSans-Bold.ttf",
    ttfUrl: `${TTF_CDN}/NotoSans-Bold.ttf`,
    type: "font/woff2",
  },
  "NotoSans-Italic": {
    woff2: "noto-sans-latin-ext-400-italic.woff2",
    ttf: "NotoSans-Italic.ttf",
    ttfUrl: `${TTF_CDN}/NotoSans-Italic.ttf`,
    type: "font/woff2",
  },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await context.params;
    const entry = FONT_ENTRIES[name];
    if (!entry) {
      return NextResponse.json({ error: "Unknown font" }, { status: 404 });
    }
    const url = new URL(request.url);
    const preferTtf = url.searchParams.get("format") === "ttf";
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

    if (preferTtf || existsSync(ttfPath)) {
      if (existsSync(ttfPath)) {
        buffer = readFileSync(ttfPath);
        contentType = "font/ttf";
      } else {
        try {
          const res = await fetch(entry.ttfUrl);
          if (!res.ok) throw new Error(`TTF fetch ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
          contentType = "font/ttf";
        } catch {
          if (existsSync(woff2Path)) {
            buffer = readFileSync(woff2Path);
          } else {
            const cdnUrl = `https://unpkg.com/@fontsource/noto-sans@5.2.10/files/${entry.woff2}`;
            const res = await fetch(cdnUrl);
            if (!res.ok) throw new Error(`CDN ${res.status}`);
            buffer = Buffer.from(await res.arrayBuffer());
          }
        }
      }
    } else if (existsSync(woff2Path)) {
      buffer = readFileSync(woff2Path);
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
    return new NextResponse(new Uint8Array(buffer), {
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
