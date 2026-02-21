# Árajánlat HTML sablon

Ez a sablon UTF-8 kódolású HTML, ezért a magyar ékezetek (á, é, ő, ű stb.) helyesen jelennek meg.

## Fájlok

- **quote.html** – Az árajánlat HTML sablonja, `{{változó}}` helykitöltőkkel
- **fill-template.ts** – TypeScript segédfüggvény a FormData → HTML konvertáláshoz

## Placeholderek (quote.html)

| Placeholder | Példa |
|-------------|-------|
| `{{headerTitle}}` | ÁRAJÁNLAT |
| `{{offerId}}` | 2024-001 |
| `{{date}}` | 2024.02.18. |
| `{{companyName}}`, `{{companyAddress}}` … | Cégadatok |
| `{{clientName}}`, `{{clientTaxNumber}}` … | Megrendelő adatai |
| `{{generalNote}}` | Megjegyzés szövege |
| `{{items}}` | A tételek HTML táblázat soraiba generálva |
| `{{netSubtotal}}`, `{{vatTotal}}`, `{{grossTotal}}` … | Összesítők |
| `{{accentColor}}`, `{{backgroundColor}}` | Design színek |

Feltételes blokkok: `{{#offerId}}...#{{offerId}}{{/offerId}}` – csak ha van offerId.

## Használat

```ts
import { generateQuoteHtml } from "./templates/fill-template";
import fs from "fs";

const templateHtml = fs.readFileSync("./templates/quote.html", "utf-8");
const html = generateQuoteHtml(formData, templateHtml);
// html → böngészőben megjeleníthető, vagy Puppeteer-rel PDF
```

## HTML → PDF (Puppeteer)

```bash
npm install puppeteer
```

```ts
import puppeteer from "puppeteer";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
await browser.close();
```
