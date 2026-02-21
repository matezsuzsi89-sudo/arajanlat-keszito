"use client";

import { Fragment } from "react";
import type { FormData, ItemData } from "@/lib/schema";
import {
  getTotals,
  getDiscountAmount,
  getFinalTotal,
  getItemNetTotal,
  getItemGrossTotal,
  groupItemsByRoom,
} from "@/lib/schema";
import PdfDesignEditor from "./PdfDesignEditor";

type Props = {
  data: FormData;
  onDataChange: (data: FormData) => void;
  errors: {
    discountPercent?: string;
    manualNetTotal?: string;
    manualGrossTotal?: string;
  };
  onExportPdf: () => void;
  onSave?: () => void;
  pdfLoading?: boolean;
  pdfSuccess?: boolean;
  saveLoading?: boolean;
};

export default function Summary({
  data,
  onDataChange,
  errors,
  onExportPdf,
  onSave,
  pdfLoading = false,
  pdfSuccess = false,
  saveLoading = false,
}: Props) {
  const { company, generalNote, validityExpiry, items, rooms = [], hasDiscount, discountPercent = 0, isItemized = true, manualNetTotal = 0, manualGrossTotal = 0 } = data;
  const { netSubtotal, grossSubtotal, vatTotal } = getTotals(items);
  const MANUAL_VAT_PERCENT = 27;
  const netVal = manualNetTotal ?? 0;
  const effectiveGross = isItemized
    ? grossSubtotal
    : (manualGrossTotal ?? 0) > 0
      ? manualGrossTotal!
      : Math.round(netVal * (1 + MANUAL_VAT_PERCENT / 100));
  const effectiveVat = isItemized ? vatTotal : Math.max(0, effectiveGross - netVal);
  const discountAmount = hasDiscount
    ? getDiscountAmount(effectiveGross, discountPercent)
    : 0;
  const finalTotal = isItemized
    ? (hasDiscount ? getFinalTotal(effectiveGross, discountPercent) : effectiveGross)
    : netVal;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Összegzés</h2>

      {(company.companyName || company.address || company.phone || company.email || company.taxNumber || company.bankAccount) && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-medium text-gray-700">Cég</h3>
          {company.companyName && (
            <p className="font-medium">{company.companyName}</p>
          )}
          {company.address && (
            <p className="text-sm text-gray-600">{company.address}</p>
          )}
          {company.phone && (
            <p className="text-sm text-gray-600">{company.phone}</p>
          )}
          {company.email && (
            <p className="text-sm text-gray-600">{company.email}</p>
          )}
          {company.taxNumber && (
            <p className="text-sm text-gray-600">Adószám: {company.taxNumber}</p>
          )}
          {company.bankAccount && (
            <p className="text-sm text-gray-600">Bankszámla: {company.bankAccount}</p>
          )}
        </div>
      )}

      {generalNote && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-medium text-gray-700">
            Általános információ
          </h3>
          <p className="whitespace-pre-wrap text-sm text-gray-600">
            {generalNote}
          </p>
        </div>
      )}

      {validityExpiry && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-medium text-gray-700">
            Érvényesség lejárata
          </h3>
          <p className="text-sm text-gray-600">
            {new Date(validityExpiry + "T12:00:00").toLocaleDateString("hu-HU")}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-2 text-left font-medium">
                Tétel
              </th>
              {isItemized ? (
                <>
                  <th className="border border-gray-200 px-2 py-2 text-left font-medium">
                    Megjegyzés
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-right font-medium">
                    Menny.
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-center font-medium">
                    ME
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-right font-medium">
                    Nettó egységár
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-center font-medium">
                    ÁFA %
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-right font-medium">
                    Nettó
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-right font-medium">
                    Bruttó
                  </th>
                </>
              ) : (
                <th className="border border-gray-200 px-2 py-2 text-left font-medium">
                  Megjegyzés
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groupItemsByRoom(items, rooms).map((group) => (
              <Fragment key={group.roomId ?? "uncat"}>
                {(rooms.length > 0 || group.roomName !== "Egyéb") && (
                  <tr className="bg-gray-100">
                    <td
                      colSpan={isItemized ? 8 : 2}
                      className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700 uppercase"
                    >
                      {group.roomName}
                    </td>
                  </tr>
                )}
                {group.items.map((item: ItemData) => (
              <Fragment key={item.id}>
                <tr className="bg-white">
                  <td className="border border-gray-200 px-2 py-2">
                    {item.name}
                  </td>
                  {isItemized ? (
                    <>
                      <td className="border border-gray-200 px-2 py-2 text-gray-600">
                        {item.note || "–"}
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-right">
                        {item.quantity}
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-center">
                        {item.unit}
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-right">
                        {item.netUnitPrice.toLocaleString("hu-HU")} Ft
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-center">
                        {item.vatPercent}%
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-right">
                        {getItemNetTotal(item).toLocaleString("hu-HU")} Ft
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-right">
                        {getItemGrossTotal(item).toLocaleString("hu-HU")} Ft
                      </td>
                    </>
                  ) : (
                    <td className="border border-gray-200 px-2 py-2 text-gray-600">
                      {item.note || "–"}
                    </td>
                  )}
                </tr>
                {!isItemized &&
                  (item.subItems ?? [])
                    .filter((s) => s.name?.trim())
                    .map((sub) => (
                      <tr
                        key={`${item.id}-${sub.id}`}
                        className="bg-gray-50/50"
                      >
                        <td className="border border-gray-200 px-2 py-1.5 pl-6 text-sm text-gray-600">
                          – {sub.name}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5" />
                      </tr>
                    ))}
              </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4">
        <div className="space-y-1 text-sm">
          {isItemized ? (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Nettó részösszeg:</span>
                <span className="font-medium">
                  {netSubtotal.toLocaleString("hu-HU")} Ft
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ÁFA összesen:</span>
                <span className="font-medium">
                  {vatTotal.toLocaleString("hu-HU")} Ft
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-700 font-medium">Bruttó végösszeg:</span>
                <span className="font-medium">
                  {grossSubtotal.toLocaleString("hu-HU")} Ft
                </span>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasDiscount}
                  onChange={(e) =>
                    onDataChange({ ...data, hasDiscount: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Kedvezmény van</span>
              </label>

              {hasDiscount && (
                <div className="mt-2">
                  <label className="mb-1 block text-sm text-gray-600">
                    Kedvezmény %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={discountPercent}
                    onChange={(e) =>
                      onDataChange({
                        ...data,
                        discountPercent:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.discountPercent && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.discountPercent}
                    </p>
                  )}
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Kedvezmény összege:</span>
                      <span>
                        {discountAmount.toLocaleString("hu-HU")} Ft
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-medium text-gray-800">
                      <span>Végösszeg kedvezmény után:</span>
                      <span>
                        {finalTotal.toLocaleString("hu-HU")} Ft
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="flex flex-col gap-1 rounded px-4 py-3 text-white"
              style={{
                background: data.pdfDesign?.accentColor ?? "#2563eb",
              }}
            >
              <label className="flex items-center gap-2 font-semibold">
                <span>Nettó végösszeg:</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={netVal > 0 ? netVal : ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                    onDataChange({
                      ...data,
                      manualNetTotal: val,
                      manualGrossTotal: Math.round(val * (1 + MANUAL_VAT_PERCENT / 100)),
                    });
                  }}
                  className="w-32 rounded border-0 bg-white/20 px-2 py-1 text-right font-semibold text-inherit placeholder:text-white/70 focus:ring-2 focus:ring-white/50"
                  placeholder="0"
                />
                <span>Ft</span>
              </label>
              <div>
                <label className="mb-1 block text-xs opacity-90">Ár megjegyzés</label>
                <select
                  value={data.priceDisclaimer ?? "labor_only"}
                  onChange={(e) =>
                    onDataChange({
                      ...data,
                      priceDisclaimer: e.target.value as "labor_only" | "material_and_labor",
                    })
                  }
                  className="w-full rounded border-0 bg-white/20 px-2 py-1.5 text-sm text-inherit focus:ring-2 focus:ring-white/50"
                >
                  <option value="labor_only">Az ár csak a munkadíjra vonatkozik.</option>
                  <option value="material_and_labor">Az ár tartalmazza az anyagköltséget és a munkadíjat is.</option>
                </select>
              </div>
              {errors.manualNetTotal && (
                <p className="text-sm text-red-200">{errors.manualNetTotal}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <PdfDesignEditor
        design={data.pdfDesign ?? {}}
        onChange={(pdfDesign) => onDataChange({ ...data, pdfDesign })}
      />

      <div className="flex flex-wrap gap-3">
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveLoading}
            className="rounded bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saveLoading ? "Mentés…" : "Ajánlat mentése"}
          </button>
        )}
        <button
          type="button"
          onClick={onExportPdf}
          disabled={pdfLoading}
          className="rounded bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {pdfLoading ? "PDF készítése…" : pdfSuccess ? "PDF letöltése (újra)" : "PDF letöltése"}
        </button>
      </div>
    </div>
  );
}
