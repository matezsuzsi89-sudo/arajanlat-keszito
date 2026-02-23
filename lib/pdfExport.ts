import {
  PDFDocument,
  StandardFonts,
  RGB,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FormData, ItemData, PdfDesign, RoomData } from "./schema";
import {
  getItemNetTotal,
  getItemGrossTotal,
  getTotals,
  getDiscountAmount,
  getFinalTotal,
  getRoomsInOrder,
  groupItemsByRoom,
  isEmptyItem,
  hasContent,
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
const ROW_WHITE = rgb(1, 1, 1);
const ROW_GREY = rgb(0.95, 0.95, 0.95);
const ROOM_GREY = rgb(0.9, 0.9, 0.9);
const TABLE_BORDER = rgb(0.75, 0.75, 0.75);
const FONT_SIZE_ROOM = 11;
const SPACE_BEFORE_TOTALS = 38;

async function loadUnicodeFonts(
  doc: import("pdf-lib").PDFDocument,
  baseUrl?: string,
  fontBytes?: { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array }
) {
  try {
    doc.registerFontkit(fontkit);
    if (fontBytes) {
      const [font, fontBold, fontItalic] = await Promise.all([
        doc.embedFont(fontBytes.regular, { subset: false }),
        doc.embedFont(fontBytes.bold, { subset: false }),
        doc.embedFont(fontBytes.italic, { subset: false }),
      ]);
      return { font, fontBold, fontItalic, useUnicode: true };
    }
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/font/`
        : baseUrl
          ? `${baseUrl.replace(/\/$/, "")}/api/font/`
          : "";
    if (!base) throw new Error("No font base URL");
    const ttfSuffix = "?format=ttf";
    const [r1, r2, r3] = await Promise.all([
      fetch(`${base}NotoSans-Regular${ttfSuffix}`),
      fetch(`${base}NotoSans-Bold${ttfSuffix}`),
      fetch(`${base}NotoSans-Italic${ttfSuffix}`),
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
  company: { phone?: string; email?: string },
  accentColor: RGB,
  font: PDFFont,
  pageWidth: number,
  pageHeight: number,
  prepare: (t: string) => string
) {
  const fs = 9;
  const contactParts: string[] = [`Tel: ${company.phone ?? ""}`];
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

function computeRowHeights(
  items: ItemData[],
  allItemIds: string[],
  rooms: RoomData[],
  isItemized: boolean
): Record<string, number> {
  const result: Record<string, number> = {};
  const roomIds = new Set(rooms.map((r) => r.id));
  const nameColWidth = isItemized ? LABEL_WIDTH - 8 : Math.floor(CONTENT_WIDTH_PT / 2) - 20;
  const roomColW = isItemized ? CONTENT_WIDTH_PT : Math.floor(CONTENT_WIDTH_PT / 2) - 20;
  for (const id of allItemIds) {
    if (roomIds.has(id)) {
      const room = rooms.find((r) => r.id === id);
      const roomH =
        room && !isItemized
          ? (wrapTextToLines((room.name ?? "").toUpperCase(), roomColW, FONT_SIZE_ROOM).length * (FONT_SIZE_ROOM + 1) +
              ROW_PADDING_TOP +
              ROW_PADDING_BOTTOM +
              4)
          : HEADER_ROW_HEIGHT + 4;
      result[id] = Math.max(HEADER_ROW_HEIGHT + 4, roomH);
      continue;
    }
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    const noteColWidth = isItemized ? nameColWidth : nameColWidth;
    const nameLines = wrapTextToLines(item.name?.trim() || "—", nameColWidth, FONT_SIZE);
    const noteLines = item.note?.trim() ? wrapTextToLines(item.note.trim(), isItemized ? nameColWidth : noteColWidth, FONT_SIZE_NOTE) : [];
    const subItems = (item.subItems ?? []).filter((s) => s.name?.trim());
    const subH = isItemized ? 0 : subItems.length * (LINE_HEIGHT_NOTE + 2);
    const nameH = nameLines.length * LINE_HEIGHT_NAME;
    const noteH = noteLines.length * LINE_HEIGHT_NOTE;
    const gap = noteH > 0 && isItemized ? GAP_NAME_NOTE : 0;
    const contentH = isItemized ? nameH + gap + noteH + subH : Math.max(nameH + subH, noteH) + (noteH > 0 ? GAP_NAME_NOTE : 0);
    result[id] = Math.max(20, contentH + ROW_PADDING_TOP + ROW_PADDING_BOTTOM + 4);
  }
  return result;
}

function drawTableHeader(
  page: PDFPage,
  headerLabels: string[],
  colX: number[],
  y: number,
  fontBold: PDFFont,
  prepare: (t: string) => string,
  accentColor: RGB
): void {
  const rectBottom = y - HEADER_ROW_HEIGHT - 2;
  page.drawRectangle({
    x: MARGIN_PT,
    y: rectBottom,
    width: CONTENT_WIDTH_PT,
    height: HEADER_ROW_HEIGHT + 4,
    color: accentColor,
  });
  const headerTextY = rectBottom + (HEADER_ROW_HEIGHT + 4) / 2 - FONT_SIZE_SMALL / 2 - 1;
  for (let i = 0; i < headerLabels.length; i++) {
    page.drawText(prepare(headerLabels[i]), {
      x: colX[i] + 4,
      y: headerTextY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  }
}

export type FontBytes = { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array };

/** Server-safe: returns raw PDF bytes. Use in API routes. */
export async function exportToPdfBytes(
  data: FormData,
  baseUrl?: string,
  fontBytes?: FontBytes
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { font, fontBold, fontItalic, useUnicode } = await loadUnicodeFonts(doc, baseUrl, fontBytes);
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
    page.drawText(prepare(`Azonosító: #${data.offerId}`), {
      x: PAGE_WIDTH_PT - MARGIN_PT - 140,
      y: pageHeight - HEADER_BAR_HEIGHT / 2 - 4,
      size: 10,
      font,
      color: rgb(1, 1, 1),
    });
  }
  let y = pageHeight - HEADER_BAR_HEIGHT - MARGIN_PT;

  const { company, client, generalNote, items, hasDiscount, discountPercent = 0, isItemized = true, manualNetTotal = 0, manualGrossTotal = 0 } = data;
  const { netSubtotal, grossSubtotal, vatTotal } = getTotals(items);
  const MANUAL_VAT = 27;
  const netVal = manualNetTotal ?? 0;
  const effectiveGross = isItemized
    ? grossSubtotal
    : (manualGrossTotal ?? 0) > 0
      ? manualGrossTotal!
      : Math.round(netVal * (1 + MANUAL_VAT / 100));
  const effectiveVat = isItemized ? vatTotal : Math.max(0, effectiveGross - netVal);
  const effectiveNet = isItemized ? netSubtotal : netVal;
  const discountAmount = hasDiscount ? getDiscountAmount(effectiveGross, discountPercent) : 0;
  const finalTotal = isItemized
    ? (hasDiscount ? getFinalTotal(effectiveGross, discountPercent) : effectiveGross)
    : netVal;

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

  const col2X = Math.floor(CONTENT_WIDTH_PT / 2);
  const roomColWForCheck = col2X - 20;
  const tableItems = items.filter((i) => !isEmptyItem(i));
  const rooms = getRoomsInOrder(data.rooms ?? []);
  const groups = groupItemsByRoom(tableItems, rooms);
  const allItemIds: string[] = [];
  for (const g of groups) {
    if (g.items.length === 0) continue;
    const room = g.roomId ? rooms.find((r) => r.id === g.roomId) : null;
    if (g.roomId && room) {
      const roomText = isItemized ? (room.name ?? "") : (room.name ?? "").toUpperCase();
      const wouldRender = wrapTextToLines(roomText.trim(), roomColWForCheck, isItemized ? 10 : FONT_SIZE_ROOM).length > 0;
      if (wouldRender && hasContent(room.name)) allItemIds.push(g.roomId);
    }
    allItemIds.push(...g.items.map((i) => i.id));
  }
  const filteredIds = allItemIds.filter((id) => {
    if (rooms.some((r) => r.id === id)) {
      const r = rooms.find((room) => room.id === id)!;
      const roomText = (r.name ?? "").trim();
      if (!roomText || !hasContent(r.name)) return false;
      const rt = isItemized ? roomText : roomText.toUpperCase();
      return wrapTextToLines(rt, roomColWForCheck, isItemized ? 10 : FONT_SIZE_ROOM).length > 0;
    }
    return true;
  });
  const rowHeights = computeRowHeights(items, filteredIds, rooms, isItemized);
  const tableTopY = y;
  const headerBg = accentColor;
  const headerY = tableTopY - HEADER_ROW_HEIGHT;
  const headerLabels = isItemized
    ? ["Tétel", "Menny.", "Egység", "Nettó egységár", "ÁFA %", "Nettó össz."]
    : ["Tétel", "Megjegyzés"];
  const colX = isItemized
    ? [MARGIN_PT, ...COL_WIDTHS.slice(0, -1).map((w, i) => MARGIN_PT + COL_WIDTHS.slice(0, i + 1).reduce((a, b) => a + b, 0))]
    : [MARGIN_PT, MARGIN_PT + col2X];
  page.drawRectangle({
    x: MARGIN_PT,
    y: headerY - 2,
    width: CONTENT_WIDTH_PT,
    height: HEADER_ROW_HEIGHT + 4,
    color: headerBg,
  });
  const headerTextY = headerY - 2 + (HEADER_ROW_HEIGHT + 4) / 2 - FONT_SIZE_SMALL / 2 - 1;
  for (let i = 0; i < headerLabels.length; i++) {
    page.drawText(prepare(headerLabels[i]), {
      x: colX[i] + 4,
      y: headerTextY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  }
  if (!isItemized) {
    page.drawLine({
      start: { x: MARGIN_PT + col2X, y: headerY - 2 },
      end: { x: MARGIN_PT + col2X, y: headerY - HEADER_ROW_HEIGHT - 6 },
      thickness: 0.5,
      color: rgb(1, 1, 1),
    });
  }
  y = headerY - HEADER_ROW_HEIGHT - 2;
  let nonItemizedRowIndex = 0;
  let tableTopForBorder = tableTopY;
  let tableSectionBottom = y;
  for (const itemId of filteredIds) {
    const isRoomHeader = rooms.some((r) => r.id === itemId);
    const item = isRoomHeader ? null : items.find((i) => i.id === itemId);
    const rowHeight = rowHeights[itemId] ?? 20;
    let rowY = y - rowHeight;
    if (rowY < MARGIN_PT + 40) {
      if (!isItemized) {
        const tblL = MARGIN_PT;
        const tblR = MARGIN_PT + CONTENT_WIDTH_PT;
        const tblT = tableTopForBorder + 2;
        const tblB = tableSectionBottom;
        const bt = 0.8;
        if (tblT > tblB) {
          page.drawLine({ start: { x: tblL, y: tblB }, end: { x: tblR, y: tblB }, thickness: bt, color: TABLE_BORDER });
          page.drawLine({ start: { x: tblR, y: tblB }, end: { x: tblR, y: tblT }, thickness: bt, color: TABLE_BORDER });
          page.drawLine({ start: { x: tblR, y: tblT }, end: { x: tblL, y: tblT }, thickness: bt, color: TABLE_BORDER });
          page.drawLine({ start: { x: tblL, y: tblT }, end: { x: tblL, y: tblB }, thickness: bt, color: TABLE_BORDER });
          page.drawLine({ start: { x: tblL + col2X, y: tblB }, end: { x: tblL + col2X, y: tblT }, thickness: bt, color: TABLE_BORDER });
        }
      }
      page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
      const { height: ph } = page.getSize();
      if (bgHex.toLowerCase() !== "#ffffff") {
        page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH_PT, height: ph, color: bgColor });
      }
      const newHeaderY = ph - MARGIN_PT - HEADER_ROW_HEIGHT - 2;
      drawTableHeader(page, headerLabels, colX, newHeaderY, fontBold, prepare, accentColor);
      if (!isItemized) {
        page.drawLine({
          start: { x: MARGIN_PT + col2X, y: newHeaderY - 2 },
          end: { x: MARGIN_PT + col2X, y: newHeaderY - HEADER_ROW_HEIGHT - 6 },
          thickness: 0.5,
          color: rgb(1, 1, 1),
        });
      }
      y = ph - MARGIN_PT - HEADER_ROW_HEIGHT - 4;
      rowY = y - rowHeight;
      tableTopForBorder = newHeaderY + 2;
      tableSectionBottom = rowY - 2;
    }
    if (isRoomHeader) {
      const room = rooms.find((r) => r.id === itemId);
      if (room) {
        const roomColW = isItemized ? CONTENT_WIDTH_PT : col2X - 20;
        const roomText = isItemized ? room.name : (room.name ?? "").toUpperCase();
        const roomLines = wrapTextToLines((roomText ?? "").trim(), roomColW, isItemized ? FONT_SIZE : FONT_SIZE_ROOM);
        if (roomLines.length === 0) continue;
        const roomBg = isItemized ? rgb(0.98, 0.98, 0.98) : ROOM_GREY;
        page.drawRectangle({
          x: MARGIN_PT,
          y: rowY - 2,
          width: CONTENT_WIDTH_PT,
          height: rowHeight + 4,
          color: roomBg,
        });
        const roomFontSize = isItemized ? FONT_SIZE : FONT_SIZE_ROOM;
        const roomLineH = roomFontSize + 1;
        let roomDrawY = rowY - ROW_PADDING_TOP;
        for (let ri = 0; ri < roomLines.length; ri++) {
          page.drawText(prepare(roomLines[ri]), {
            x: MARGIN_PT + 4,
            y: roomDrawY - (ri + 1) * roomLineH,
            size: roomFontSize,
            font: fontBold,
          });
        }
      }
      if (!isItemized) nonItemizedRowIndex++;
      y = rowY - 2;
      continue;
    }
    if (!item) continue;
    const subItems = (item.subItems ?? []).filter((s) => s.name?.trim());
    const wouldShowOnlyPlaceholder = !hasContent(item.name) && !hasContent(item.note) && subItems.length === 0;
    if (wouldShowOnlyPlaceholder) continue;
    const nameColWidthLocal = isItemized ? LABEL_WIDTH - 8 : col2X - 20;
    const noteColWidthLocal = isItemized ? LABEL_WIDTH - 8 : col2X - 20;
    const nameLines = wrapTextToLines(item.name.trim() || "—", nameColWidthLocal, FONT_SIZE);
    const noteLines = (item.note?.trim() ? wrapTextToLines(item.note.trim(), nameColWidthLocal, FONT_SIZE_NOTE) : []) as string[];
    const nameH = nameLines.length * LINE_HEIGHT_NAME;
    const noteH = noteLines.length * LINE_HEIGHT_NOTE;
    const gap = noteH > 0 ? GAP_NAME_NOTE : 0;
    const subH = isItemized ? 0 : subItems.length * (LINE_HEIGHT_NOTE + 2);
    const cellH = Math.max(rowHeight, nameH + gap + noteH + subH + ROW_PADDING_TOP + ROW_PADDING_BOTTOM);
    const borderY = rowY - cellH - 2;
    const rowBg = isItemized
      ? ROW_WHITE
      : nonItemizedRowIndex % 2 === 0
        ? ROW_WHITE
        : ROW_GREY;
    page.drawRectangle({
      x: MARGIN_PT,
      y: borderY,
      width: CONTENT_WIDTH_PT,
      height: cellH + 4,
      color: rowBg,
    });
    page.drawRectangle({
      x: MARGIN_PT,
      y: borderY,
      width: CONTENT_WIDTH_PT,
      height: 1,
      color: ROW_BORDER,
    });
    const startY = rowY - ROW_PADDING_TOP;
    for (let i = 0; i < nameLines.length; i++) {
      page.drawText(prepare(nameLines[i]), {
        x: colX[0] + 4,
        y: startY - (i + 1) * LINE_HEIGHT_NAME,
        size: FONT_SIZE,
        font,
      });
    }
    if (isItemized) {
      let noteY = startY - nameH - gap;
      for (let i = 0; i < noteLines.length; i++) {
        page.drawText(prepare(noteLines[i]), {
          x: colX[0] + 4,
          y: noteY - (i + 1) * LINE_HEIGHT_NOTE,
          size: FONT_SIZE_NOTE,
          font: fontItalic,
        });
      }
    } else {
      const itemNoteSize = FONT_SIZE;
      const itemNoteLineH = LINE_HEIGHT_NAME;
      const noteLinesRight = wrapTextToLines(item.note?.trim() ?? "", noteColWidthLocal, itemNoteSize);
      for (let i = 0; i < noteLinesRight.length; i++) {
        page.drawText(prepare(noteLinesRight[i]), {
          x: colX[1] + 4,
          y: startY - (i + 1) * itemNoteLineH,
          size: itemNoteSize,
          font: fontItalic,
        });
      }
      const subIndent = 12;
      const subLineH = itemNoteLineH + 2;
      let subY = startY - nameH - gap;
      for (let si = 0; si < subItems.length; si++) {
        const subName = subItems[si].name?.trim() ?? "";
        page.drawText(prepare(`– ${subName}`), {
          x: colX[0] + 4 + subIndent,
          y: subY - (si + 1) * subLineH,
          size: itemNoteSize,
          font,
        });
      }
    }
    if (isItemized) {
      const netTotal = getItemNetTotal(item);
      page.drawText(prepare(String(item.quantity)), { x: colX[1] + 4, y: rowY - cellH / 2 - 4, size: FONT_SIZE, font });
      page.drawText(prepare(item.unit), { x: colX[2] + 4, y: rowY - cellH / 2 - 4, size: FONT_SIZE, font });
      page.drawText(prepare(item.netUnitPrice.toLocaleString("hu-HU")), { x: colX[3] + 4, y: rowY - cellH / 2 - 4, size: FONT_SIZE, font });
      page.drawText(prepare(String(item.vatPercent)), { x: colX[4] + 4, y: rowY - cellH / 2 - 4, size: FONT_SIZE, font });
      page.drawText(prepare(netTotal.toLocaleString("hu-HU")), { x: colX[5] + 4, y: rowY - cellH / 2 - 4, size: FONT_SIZE, font });
    } else {
      nonItemizedRowIndex++;
    }
    y = rowY - cellH - 4;
    tableSectionBottom = borderY - 2;
  }
  if (!isItemized && tableTopForBorder > tableSectionBottom) {
    const tblL = MARGIN_PT;
    const tblR = MARGIN_PT + CONTENT_WIDTH_PT;
    const tblT = tableTopForBorder + 2;
    const tblB = tableSectionBottom;
    const bt = 0.8;
    page.drawLine({ start: { x: tblL, y: tblB }, end: { x: tblR, y: tblB }, thickness: bt, color: TABLE_BORDER });
    page.drawLine({ start: { x: tblR, y: tblB }, end: { x: tblR, y: tblT }, thickness: bt, color: TABLE_BORDER });
    page.drawLine({ start: { x: tblR, y: tblT }, end: { x: tblL, y: tblT }, thickness: bt, color: TABLE_BORDER });
    page.drawLine({ start: { x: tblL, y: tblT }, end: { x: tblL, y: tblB }, thickness: bt, color: TABLE_BORDER });
    page.drawLine({ start: { x: tblL + col2X, y: tblB }, end: { x: tblL + col2X, y: tblT }, thickness: bt, color: TABLE_BORDER });
  }
  y -= SPACE_BEFORE_TOTALS;

  const summaryLabelWidth = 200;
  const summaryValueWidth = 110;
  const summaryRowHeight = 22;
  const summaryFontSize = 12;
  const summaryWidth = summaryLabelWidth + summaryValueWidth;
  const summaryX = PAGE_WIDTH_PT - MARGIN_PT - summaryWidth;
  const valueXEnd = summaryX + summaryWidth;
  let sumY = y;

  if (isItemized) {
    const summaryRows: { label: string; value: string; color?: RGB }[] = [
      { label: "Nettó részösszeg", value: `${effectiveNet.toLocaleString("hu-HU")} Ft` },
      { label: "ÁFA összesen", value: `${effectiveVat.toLocaleString("hu-HU")} Ft` },
      { label: "Bruttó végösszeg", value: `${effectiveGross.toLocaleString("hu-HU")} Ft` },
    ];
    if (hasDiscount && discountPercent > 0) {
      summaryRows.push({
        label: `Kedvezmény (${discountPercent}%)`,
        value: `-${discountAmount.toLocaleString("hu-HU")} Ft`,
        color: RED,
      });
    }
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
  }

  const finalLabel = isItemized
    ? (hasDiscount && discountPercent > 0 ? "Végösszeg kedvezmény után" : "Végösszeg")
    : "Nettó végösszeg";
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
  y -= finalBarHeight + 4;

  const priceDisclaimer = data.priceDisclaimer ?? "labor_only";
  const disclaimerText =
    priceDisclaimer === "material_and_labor"
      ? "Az ár tartalmazza az anyagköltséget és a munkadíjat is."
      : "Az ár csak a munkadíjra vonatkozik.";
  page.drawText(prepare(disclaimerText), {
    x: summaryX,
    y: y - 12,
    size: FONT_SIZE_SMALL,
    font,
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
  return new Uint8Array(pdfBytes);
}

export async function exportToPdf(data: FormData): Promise<string> {
  const pdfBytes = await exportToPdfBytes(data);

  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
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
