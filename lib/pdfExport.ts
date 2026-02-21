import {
  PDFDocument,
  StandardFonts,
  RGB,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FormData, ItemData, PdfDesign } from "./schema";
import {
  getItemNetTotal,
  getItemGrossTotal,
  getTotals,
  getDiscountAmount,
  getFinalTotal,
} from "./schema";

const FONT_SIZE = 10;
const FONT_SIZE_SMALL = 8;
const FONT_SIZE_NOTE = 7;
const MARGIN_PT = 56;
const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - 2 * MARGIN_PT;
const HEADER_BAR_HEIGHT = 44;
const FOOTER_BAR_HEIGHT = 32;
const COL_WIDTHS = [40, 28, 72, 32, 58, 58];
const LABEL_WIDTH = 140;
const ROW_PADDING_TOP = 4;
const ROW_PADDING_BOTTOM = 6;
const GAP_NAME_NOTE = 2;
const LINE_HEIGHT_NAME = 9;
const LINE_HEIGHT_NOTE = 6;
const HEADER_ROW_HEIGHT = 18;
const RED = rgb(0.75, 0.1, 0.1);
const ROW_BORDER = rgb(0.93, 0.93, 0.93);
const SPACE_BEFORE_TOTALS = 38;

async function loadUnicodeFonts(doc: import("pdf-lib").PDFDocument) {
  try {
    throw new Error("Use Helvetica fallback"); // Unicode font disabled – use readable ASCII
    doc.registerFontkit(fontkit);
    if (typeof window === "undefined") throw new Error("No window");
    const base = `${window.location.origin}/api/font/`;
    const [r1, r2, r3] = await Promise.all([
      fetch(`${base}NotoSans-Regular`),
      fetch(`${base}NotoSans-Bold`),
      fetch(`${base}NotoSans-Italic`),
    ]);
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error("Font fetch failed");
    const [font, fontBold, fontItalic] = await Promise.all([
      doc.embedFont(new Uint8Array(await r1.arrayBuffer()), { subset: false }),
      doc.embedFont(new Uint8Array(await r2.arrayBuffer()), { subset: false }),
      doc.embedFont(new Uint8Array(await r3.arrayBuffer()), { subset: false }),
    ]);
    return { font, fontBold, fontItalic, useUnicode: true };
  } catch {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
    return { font, fontBold, fontItalic, useUnicode: false };
  }
}

const ACCENT_MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ö: "o", ő: "o", ú: "u", ü: "u", ű: "u",
  Á: "A", É: "E", Í: "I", Ó: "O", Ö: "O", Ő: "O", Ú: "U", Ü: "U", Ű: "U",
};

function prepareText(text: string, useUnicode: boolean): string {
  return useUnicode ? text : text.replace(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, (c) => ACCENT_MAP[c] ?? c);
}

function hexToRgb(hex: string): RGB {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function wrapTextToLines(
  text: string,
  maxWidthPt: number,
  fontSize: number
): string[] {
  if (!text.trim()) return [];
  const approxCharWidth = fontSize * 0.48;
  const charsPerLine = Math.max(1, Math.floor(maxWidthPt / approxCharWidth));
  const allLines: string[] = [];
  const paragraphs = text.trim().split(/\r?\n/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    let remaining = trimmed;
    while (remaining.length > 0) {
      if (remaining.length <= charsPerLine) {
        allLines.push(remaining);
        break;
      }
      let breakAt = remaining.slice(0, charsPerLine).lastIndexOf(" ");
      if (breakAt <= 0) breakAt = charsPerLine;
      allLines.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
  }
  return allLines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  prepare: (t: string) => string
): number {
  const lines = wrapTextToLines(text, maxWidth, size);
  const lineSpacing = size + 1;
  for (let i = 0; i < lines.length; i++) {
    page.drawText(prepare(lines[i]), { x, y: y - i * lineSpacing, size, font });
  }
  return lines.length * lineSpacing;
}

function drawFooter(
  page: PDFPage,
  company: { phone: string; email?: string },
  accentColor: RGB,
  font: PDFFont,
  pageWidth: number,
  pageHeight: number,
  prepare: (t: string) => string
) {
  const fs = 9;
  const contactParts: string[] = [`Tel: ${company.phone}`];
  if (company.email?.trim()) contactParts.push(`E-mail: ${company.email}`);
  const contactStr = prepare(contactParts.join("  |  "));
  const dateStr = prepare(new Date().toLocaleDateString("hu-HU"));

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: FOOTER_BAR_HEIGHT,
    color: accentColor,
  });
  page.drawText(contactStr, {
    x: MARGIN_PT,
    y: FOOTER_BAR_HEIGHT / 2 - fs / 2 - 1,
    size: fs,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText(dateStr, {
    x: pageWidth - MARGIN_PT - font.widthOfTextAtSize(dateStr, fs),
    y: FOOTER_BAR_HEIGHT / 2 - fs / 2 - 1,
    size: fs,
    font,
    color: rgb(1, 1, 1),
  });
}

export async function exportToPdf(data: FormData): Promise<string> {
  const doc = await PDFDocument.create();
  const { font, fontBold, fontItalic, useUnicode } = await loadUnicodeFonts(doc);
  const prepare = (t: string) => prepareText(t, useUnicode);

  let page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  const { height: pageHeight } = page.getSize();

  const design: PdfDesign = data.pdfDesign ?? {};
  const bgHex = design.backgroundColor ?? "#ffffff";
  const headerTitle = (design.headerTitle ?? "ÁRAJÁNLAT").trim() || "ÁRAJÁNLAT";
  const accentHex = design.accentColor ?? "#2563eb";
  const bgColor = hexToRgb(bgHex);
  const accentColor = hexToRgb(accentHex);

  if (bgHex.toLowerCase() !== "#ffffff") {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH_PT,
      height: pageHeight,
      color: bgColor,
    });
  }

  page.drawRectangle({
    x: 0,
    y: pageHeight - HEADER_BAR_HEIGHT,
    width: PAGE_WIDTH_PT,
    height: HEADER_BAR_HEIGHT,
    color: accentColor,
  });
  page.drawText(prepare(headerTitle), {
    x: MARGIN_PT,
    y: pageHeight - HEADER_BAR_HEIGHT / 2 - 5,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  if (data.offerId) {
    page.drawText(prepare(`#${data.offerId}`), {
      x: PAGE_WIDTH_PT - MARGIN_PT - 80,
      y: pageHeight - HEADER_BAR_HEIGHT / 2 - 4,
      size: 10,
      font: font,
      color: rgb(1, 1, 1),
    });
  }

  let y = pageHeight - HEADER_BAR_HEIGHT - MARGIN_PT;

  const { company, client, generalNote, items, hasDiscount, discountPercent = 0 } = data;
  const { netSubtotal, grossSubtotal, vatTotal } = getTotals(items);
  const discountAmount = hasDiscount
    ? getDiscountAmount(grossSubtotal, discountPercent)
    : 0;
  const finalTotal = hasDiscount
    ? getFinalTotal(grossSubtotal, discountPercent)
    : grossSubtotal;

  if (company.logoDataUrl) {
    try {
      const bytes = dataUrlToBytes(company.logoDataUrl);
      const image = company.logoDataUrl.startsWith("data:image/png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      const imgW = 90;
      const imgH = (image.height / image.width) * imgW;
      page.drawImage(image, {
        x: MARGIN_PT,
        y: y - imgH,
        width: imgW,
        height: imgH,
      });
      y -= imgH + 14;
    } catch {
      // skip logo
    }
  }

  const colWidth = (CONTENT_WIDTH_PT - 20) / 2;
  const leftX = MARGIN_PT;
  const rightX = MARGIN_PT + colWidth + 20;

  page.drawText(prepare(`Dátum: ${new Date().toLocaleDateString("hu-HU")}`), {
    x: leftX,
    y,
    size: FONT_SIZE,
    font,
  });
  y -= 18;

  let leftY = y;
  let rightY = y;

  page.drawText(prepare(company.companyName ?? ""), {
    x: leftX,
    y: leftY,
    size: FONT_SIZE,
    font: fontBold,
  });
  leftY -= FONT_SIZE + 2;
  page.drawText(prepare(company.address ?? ""), { x: leftX, y: leftY, size: FONT_SIZE, font });
  leftY -= FONT_SIZE + 2;
  page.drawText(prepare(`Tel: ${company.phone ?? ""}`), { x: leftX, y: leftY, size: FONT_SIZE, font });
  leftY -= FONT_SIZE + 2;
  page.drawText(prepare(`Adószám: ${company.taxNumber ?? ""}`), { x: leftX, y: leftY, size: FONT_SIZE, font });
  leftY -= FONT_SIZE + 2;
  page.drawText(prepare(`Bankszámla: ${company.bankAccount ?? ""}`), { x: leftX, y: leftY, size: FONT_SIZE, font });
  leftY -= FONT_SIZE + 2;
  if (company.email) {
    page.drawText(prepare(`E-mail: ${company.email ?? ""}`), { x: leftX, y: leftY, size: FONT_SIZE, font });
    leftY -= FONT_SIZE + 2;
  }

  const clientName =
    client && "kind" in client
      ? client.kind === "company"
        ? client.companyName?.trim()
        : client.personName?.trim()
      : (client as { name?: string } | undefined)?.name?.trim();
  const hasClient = !!clientName;
  if (hasClient && client) {
    page.drawText(prepare("Megrendelő"), {
      x: rightX,
      y: rightY,
      size: FONT_SIZE,
      font: fontBold,
    });
    rightY -= FONT_SIZE + 2;
    page.drawText(prepare(clientName!), { x: rightX, y: rightY, size: FONT_SIZE, font });
    rightY -= FONT_SIZE + 2;
    if ("kind" in client && client.kind === "company" && client.taxNumber?.trim()) {
      page.drawText(prepare(`Adószám: ${client.taxNumber ?? ""}`), { x: rightX, y: rightY, size: FONT_SIZE, font });
      rightY -= FONT_SIZE + 2;
    }
    if (client.address?.trim()) {
      page.drawText(prepare(client.address ?? ""), { x: rightX, y: rightY, size: FONT_SIZE, font });
      rightY -= FONT_SIZE + 2;
    }
    if (client.phone?.trim()) {
      page.drawText(prepare(`Tel: ${client.phone ?? ""}`), { x: rightX, y: rightY, size: FONT_SIZE, font });
      rightY -= FONT_SIZE + 2;
    }
    if (client.email?.trim()) {
      page.drawText(prepare(`E-mail: ${client.email ?? ""}`), { x: rightX, y: rightY, size: FONT_SIZE, font });
      rightY -= FONT_SIZE + 2;
    }
  }
  y = Math.min(leftY, rightY) - 10;

  if (generalNote.trim()) {
    page.drawText(prepare("Általános információ"), {
      x: MARGIN_PT,
      y,
      size: FONT_SIZE,
      font: fontBold,
    });
    y -= FONT_SIZE + 4;
    const noteHeight = drawWrappedText(
      page,
      generalNote.trim(),
      MARGIN_PT,
      y,
      CONTENT_WIDTH_PT,
      FONT_SIZE,
      font,
      prepare
    );
    y -= noteHeight + 12;
  }

  const colW1 = CONTENT_WIDTH_PT - COL_WIDTHS.reduce((a, b) => a + b, 0);
  const tételCellWidth = colW1 - 10;
  const headerLabels = ["Tétel", "Menny.", "ME", "Nettó egys.", "ÁFA %", "Nettó", "Bruttó"];
  const allColWidths = [colW1, ...COL_WIDTHS];

  page.drawRectangle({
    x: MARGIN_PT,
    y: y - HEADER_ROW_HEIGHT,
    width: CONTENT_WIDTH_PT,
    height: HEADER_ROW_HEIGHT,
    color: accentColor,
  });
  let headerX = MARGIN_PT;
  headerLabels.forEach((h, i) => {
    const pad = i === 0 ? 6 : 4;
    const cellW = allColWidths[i];
    const labelStr = prepare(h);
    const labelW = fontBold.widthOfTextAtSize(labelStr, FONT_SIZE_SMALL);
    const isRightAlign = i > 0;
    const headerTextX = isRightAlign
      ? headerX + cellW - labelW - pad
      : headerX + pad;
    page.drawText(labelStr, {
      x: headerTextX,
      y: y - HEADER_ROW_HEIGHT + 5,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    headerX += cellW;
  });
  y -= HEADER_ROW_HEIGHT;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx] as ItemData;
    const nameLines = wrapTextToLines(item.name, tételCellWidth, FONT_SIZE_SMALL);
    const noteLines =
      item.note && item.note.trim()
        ? wrapTextToLines(item.note.trim(), tételCellWidth, FONT_SIZE_NOTE)
        : [];

    const contentHeight =
      nameLines.length * LINE_HEIGHT_NAME +
      (noteLines.length ? GAP_NAME_NOTE + noteLines.length * LINE_HEIGHT_NOTE : 0);
    const rowHeight = ROW_PADDING_TOP + contentHeight + ROW_PADDING_BOTTOM;

    if (y - rowHeight < MARGIN_PT + FOOTER_BAR_HEIGHT + 50) {
      page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
      if (bgHex.toLowerCase() !== "#ffffff") {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: PAGE_WIDTH_PT,
          height: PAGE_HEIGHT_PT,
          color: bgColor,
        });
      }
      y = pageHeight - MARGIN_PT;
    }

    const rowTop = y - ROW_PADDING_TOP;
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: MARGIN_PT,
        y: y - rowHeight,
        width: CONTENT_WIDTH_PT,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.98),
      });
    }
    page.drawLine({
      start: { x: MARGIN_PT, y: y - rowHeight },
      end: { x: MARGIN_PT + CONTENT_WIDTH_PT, y: y - rowHeight },
      thickness: 0.25,
      color: ROW_BORDER,
    });

    let textY = rowTop - 4;
    for (let i = 0; i < nameLines.length; i++) {
      page.drawText(prepare(nameLines[i]), {
        x: MARGIN_PT + 6,
        y: textY,
        size: FONT_SIZE_SMALL,
        font: fontBold,
      });
      textY -= LINE_HEIGHT_NAME;
    }
    if (noteLines.length) {
      textY -= GAP_NAME_NOTE;
      for (let i = 0; i < noteLines.length; i++) {
        page.drawText(prepare(noteLines[i]), {
          x: MARGIN_PT + 6,
          y: textY,
          size: FONT_SIZE_NOTE,
          font: fontItalic,
        });
        textY -= LINE_HEIGHT_NOTE;
      }
    }

    const restCells = [
      String(item.quantity),
      item.unit,
      `${item.netUnitPrice.toLocaleString("hu-HU")} Ft`,
      `${item.vatPercent}%`,
      `${getItemNetTotal(item).toLocaleString("hu-HU")} Ft`,
      `${getItemGrossTotal(item).toLocaleString("hu-HU")} Ft`,
    ];
    const dataY = rowTop - 4;
    const cellPad = 4;
    let cellX = MARGIN_PT + colW1;
    restCells.forEach((cell, i) => {
      const w = COL_WIDTHS[i];
      const text = cell.length > 14 ? cell.slice(0, 12) + "…" : cell;
      const textStr = prepare(text);
      const textW = font.widthOfTextAtSize(textStr, FONT_SIZE_SMALL);
      const x = cellX + Math.max(0, w - cellPad - textW);
      page.drawText(textStr, {
        x,
        y: dataY,
        size: FONT_SIZE_SMALL,
        font,
      });
      cellX += w;
    });

    y -= rowHeight;
  }

  y -= SPACE_BEFORE_TOTALS;

  if (y < MARGIN_PT + FOOTER_BAR_HEIGHT + 160) {
    page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
    if (bgHex.toLowerCase() !== "#ffffff") {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH_PT,
        height: PAGE_HEIGHT_PT,
        color: bgColor,
      });
    }
    y = pageHeight - MARGIN_PT;
  }

  const summaryLabelWidth = 200;
  const summaryValueWidth = 110;
  const summaryRowHeight = 22;
  const summaryFontSize = 12;
  const summaryWidth = summaryLabelWidth + summaryValueWidth;
  const summaryX = PAGE_WIDTH_PT - MARGIN_PT - summaryWidth;
  const summaryRows: { label: string; value: string; color?: RGB }[] = [
    { label: "Nettó részösszeg", value: `${netSubtotal.toLocaleString("hu-HU")} Ft` },
    { label: "ÁFA összesen", value: `${vatTotal.toLocaleString("hu-HU")} Ft` },
    { label: "Bruttó végösszeg", value: `${grossSubtotal.toLocaleString("hu-HU")} Ft` },
  ];
  if (hasDiscount && discountPercent > 0) {
    summaryRows.push({
      label: `Kedvezmény (${discountPercent}%)`,
      value: `-${discountAmount.toLocaleString("hu-HU")} Ft`,
      color: RED,
    });
  }
  const valueXEnd = summaryX + summaryWidth;
  let sumY = y;
  const rowTextOffset = summaryRowHeight / 2 - summaryFontSize / 2 - 1;
  summaryRows.forEach((row) => {
    const valStr = prepare(row.value);
    const valW = font.widthOfTextAtSize(valStr, summaryFontSize);
    page.drawText(prepare(row.label), {
      x: summaryX,
      y: sumY - rowTextOffset,
      size: summaryFontSize,
      font,
      color: row.color,
    });
    page.drawText(valStr, {
      x: valueXEnd - valW - 8,
      y: sumY - rowTextOffset,
      size: summaryFontSize,
      font,
      color: row.color,
    });
    sumY -= summaryRowHeight;
  });
  y = sumY - 6;

  const finalLabel = hasDiscount && discountPercent > 0 ? "Végösszeg kedvezmény után" : "Végösszeg";
  const finalValue = `${finalTotal.toLocaleString("hu-HU")} Ft`;
  const finalValStr = prepare(finalValue);
  const finalBarHeight = 26;
  const finalSize = 14;
  const finalValW = fontBold.widthOfTextAtSize(finalValStr, finalSize);
  page.drawRectangle({
    x: summaryX,
    y: y - finalBarHeight - 4,
    width: summaryWidth,
    height: finalBarHeight + 4,
    color: accentColor,
  });
  page.drawText(prepare(finalLabel), {
    x: summaryX + 8,
    y: y - finalBarHeight,
    size: summaryFontSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(finalValStr, {
    x: valueXEnd - finalValW - 8,
    y: y - finalBarHeight,
    size: finalSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  if (company.quotePreparedBy?.trim()) {
    const preparedY = y - finalBarHeight - 4 - 20;
    page.drawText(
      prepare(`Árajánlatot készítette: ${company.quotePreparedBy?.trim() ?? ""}`),
      {
        x: MARGIN_PT,
        y: preparedY,
        size: FONT_SIZE,
        font,
      }
    );
  }

  const pages = doc.getPages();
  for (const p of pages) {
    const { width, height } = p.getSize();
    drawFooter(p, company, accentColor, font, width, height, prepare);
  }

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const displayName =
    data.client?.kind === "company"
      ? data.client?.companyName
      : data.client?.kind === "individual"
        ? data.client?.personName
        : "";
  const safeName = (displayName ?? "ajanlat")
    .replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "ajanlat";
  const filename = data.offerId
    ? `${data.offerId}_${safeName}.pdf`
    : `arajánlat-${new Date().toISOString().slice(0, 10)}.pdf`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 300);

  return url;
}
