#!/usr/bin/env node
/**
 * Letölti a Noto Sans TTF betűtípusokat a PDF export számára.
 * Futtatás: node scripts/download-fonts.mjs
 */
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "fonts");
const BASE = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans";

const FONTS = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans-Italic.ttf"];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const name of FONTS) {
    const url = `${BASE}/${name}`;
    console.log(`Letöltés: ${name}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(OUT_DIR, name), buf);
    console.log(`  Mentve: ${OUT_DIR}/${name}`);
  }
  console.log("Kész.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
