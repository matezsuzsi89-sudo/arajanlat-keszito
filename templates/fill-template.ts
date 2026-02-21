/**
 * Árajánlat HTML sablon kitöltése FormData alapján.
 * Használat: generateQuoteHtml(data) → HTML string
 * A kimenetet böngészőben renderelheted, vagy Puppeteer-rel PDF-re konvertálhatod.
 */

import type { FormData, ItemData } from "../lib/schema";
import {
  getItemNetTotal,
  getItemGrossTotal,
  getTotals,
  getDiscountAmount,
  getFinalTotal,
  groupItemsByRoom,
} from "../lib/schema";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("hu-HU");
}

/** Sötét háttér → fehér betű, világos háttér → fekete betű (WCAG luminance alapján) */
export function getContrastTextColor(hexBg: string): "#ffffff" | "#1a1a1a" {
  let hex = hexBg.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  let r: number, g: number, b: number;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else if (hex.length >= 6) {
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  } else {
    return "#ffffff";
  }
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.5 ? "#1a1a1a" : "#ffffff";
}

function renderItemRow(item: ItemData, isItemized: boolean, colCount: number): string {
  const name = escapeHtml(item.name);
  const note = item.note?.trim()
    ? `<div class="item-note">${escapeHtml(item.note)}</div>`
    : "";
  const qty = item.quantity;
  const unit = escapeHtml(item.unit);
  if (!isItemized) {
    const subItems = item.subItems ?? [];
    const noteVal = item.note?.trim() ? escapeHtml(item.note) : "";
    const subRows = subItems
      .filter((s) => s.name?.trim())
      .map(
        (s) =>
          `<tr class="sub-item-row"><td class="sub-item-cell"><span class="sub-item-bullet">–</span> ${escapeHtml(s.name)}</td><td colspan="${colCount - 1}"></td></tr>`
      )
      .join("\n");
    return `<tr>
      <td><div class="item-name">${name}</div></td>
      <td>${noteVal}</td>
    </tr>${subRows}`;
  }
  const netUnit = formatNum(item.netUnitPrice);
  const vat = item.vatPercent;
  const net = formatNum(getItemNetTotal(item));
  const gross = formatNum(getItemGrossTotal(item));
  return `<tr>
    <td><div class="item-name">${name}</div>${note}</td>
    <td>${qty}</td>
    <td>${unit}</td>
    <td>${netUnit} Ft</td>
    <td>${vat}%</td>
    <td>${net} Ft</td>
    <td>${gross} Ft</td>
  </tr>`;
}

function renderItems(
  items: ItemData[],
  isItemized: boolean,
  rooms: { id: string; name: string }[] = []
): string {
  const colCount = isItemized ? 7 : 2;
  const groups = groupItemsByRoom(items, rooms);
  return groups
    .map((group) => {
      const showRoomHeader = rooms.length > 0 || group.roomName !== "Egyéb";
      const header = showRoomHeader
        ? `<tr class="room-header-row"><td colspan="${colCount}" class="room-header-cell">${escapeHtml(group.roomName)}</td></tr>`
        : "";
      const rows = group.items
        .map((item) => renderItemRow(item, isItemized, colCount))
        .join("\n");
      return header + rows;
    })
    .join("\n");
}

export function generateQuoteHtml(data: FormData, templateHtml: string): string {
  const { company, client, generalNote, validityExpiry, items, rooms = [], hasDiscount, discountPercent = 0, isItemized = true, manualNetTotal = 0, manualGrossTotal = 0, priceDisclaimer = "labor_only" } = data;
  const design = data.pdfDesign ?? {};
  const accentColor = design.accentColor ?? "#2563eb";
  const accentTextColor = getContrastTextColor(accentColor);
  const backgroundColor = design.backgroundColor ?? "#ffffff";
  const headerTitle = (design.headerTitle ?? "ÁRAJÁNLAT").trim() || "ÁRAJÁNLAT";

  const { netSubtotal, grossSubtotal, vatTotal } = getTotals(items);
  const MANUAL_VAT_PERCENT = 27;
  const netVal = manualNetTotal ?? 0;
  const effectiveGross = isItemized
    ? grossSubtotal
    : (manualGrossTotal ?? 0) > 0
      ? manualGrossTotal!
      : Math.round(netVal * (1 + MANUAL_VAT_PERCENT / 100));
  const effectiveVat = isItemized ? vatTotal : Math.max(0, effectiveGross - netVal);
  const discountAmount = hasDiscount ? getDiscountAmount(effectiveGross, discountPercent) : 0;
  const finalTotal = isItemized
    ? (hasDiscount ? getFinalTotal(effectiveGross, discountPercent) : effectiveGross)
    : netVal;

  const clientName =
    client?.kind === "company"
      ? client.companyName?.trim()
      : client?.kind === "individual"
        ? client.personName?.trim()
        : "";

  const date = new Date().toLocaleDateString("hu-HU");
  const contactParts: string[] = [];
  if (company.phone?.trim()) contactParts.push(`Tel: ${company.phone}`);
  if (company.email?.trim()) contactParts.push(`E-mail: ${company.email}`);

  const trim = (s: string | undefined) => (s ?? "").trim();
  const companyName = trim(company.companyName);
  const companyAddress = trim(company.address);
  const companyPhone = trim(company.phone);
  const companyTaxNumber = trim(company.taxNumber);
  const companyBankAccount = trim(company.bankAccount);
  const companyEmail = trim(company.email);
  const clientTaxNumber = trim(client?.kind === "company" ? (client as { taxNumber?: string }).taxNumber : "");
  const hasClientTaxNumber = client?.kind === "company";
  const clientAddress = trim(client?.address);
  const clientPhone = trim(client?.phone);
  const clientEmail = trim(client?.email);
  const hasCompanyData = !!(companyName || companyAddress || companyPhone || companyTaxNumber || companyBankAccount || companyEmail);
  const hasClientData = !!(clientName || clientTaxNumber || clientAddress || clientPhone || clientEmail);
  const hasCompanyOrClient = hasCompanyData || hasClientData;

  const vars: Record<string, string | number | boolean | undefined> = {
    headerTitle,
    offerId: data.offerId ?? "",
    date,
    companyName,
    companyAddress,
    companyPhone,
    companyTaxNumber,
    companyBankAccount,
    companyEmail,
    logoDataUrl: company.logoDataUrl ?? "",
    clientName: clientName ?? "",
    clientTaxNumber,
    hasClientTaxNumber,
    clientAddress,
    clientPhone,
    clientEmail,
    hasCompanyData,
    hasClientData,
    hasCompanyOrClient,
    generalNote: generalNote?.trim() ?? "",
    validityExpiry: validityExpiry?.trim()
      ? new Date(validityExpiry + "T12:00:00").toLocaleDateString("hu-HU")
      : "",
    dateOrValidity: validityExpiry?.trim()
      ? new Date(validityExpiry + "T12:00:00").toLocaleDateString("hu-HU")
      : date,
    items: renderItems(items, isItemized, rooms),
    isItemized,
    isNonItemized: !isItemized,
    netSubtotal: formatNum(isItemized ? netSubtotal : netVal),
    vatTotal: formatNum(effectiveVat),
    grossTotal: formatNum(effectiveGross),
    manualVatPercent: MANUAL_VAT_PERCENT,
    discountPercent,
    discountAmount: formatNum(discountAmount),
    finalLabel: "Végösszeg:",
    finalTotal: formatNum(finalTotal),
    quotePreparedBy: company.quotePreparedBy?.trim() ?? "",
    footerContact: contactParts.join("  |  "),
    footerDate: date,
    accentColor,
    accentTextColor,
    backgroundColor,
    hasDiscount: hasDiscount && discountPercent > 0,
    priceDisclaimerNote:
      priceDisclaimer === "material_and_labor"
        ? "Az ár tartalmazza az anyagköltséget és a munkadíjat is."
        : "Az ár csak a munkadíjra vonatkozik.",
  };

  let out = templateHtml;

  // Feltételes blokkok: {{#key}}...{{/key}} – addig ismételjük, amíg van beágyazott
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
      const v = vars[key];
      const isEmpty = v === undefined || v === "" || v === false || v === 0 ||
        (typeof v === "string" && v.trim() === "");
      return isEmpty ? "" : content;
    });
  }

  // Egyszerű placeholder cserék
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    out = out.replace(re, String(val ?? ""));
  }

  return out;
}
