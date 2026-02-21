"use client";

import type { PdfDesign } from "@/lib/schema";

const PRESET_BG = [
  { label: "Fehér", value: "#ffffff" },
  { label: "Halvány szürke", value: "#f8fafc" },
  { label: "Halvány kék", value: "#f0f9ff" },
  { label: "Halvány zöld", value: "#f0fdf4" },
  { label: "Krém", value: "#fffbeb" },
];

const PRESET_ACCENT = [
  { label: "Kék", value: "#2563eb" },
  { label: "Zöld", value: "#16a34a" },
  { label: "Lila", value: "#7c3aed" },
  { label: "Bordó", value: "#b91c1c" },
  { label: "Sötét", value: "#1e293b" },
];

type Props = {
  design: PdfDesign;
  onChange: (design: PdfDesign) => void;
};

export default function PdfDesignEditor({ design, onChange }: Props) {
  const bg = design?.backgroundColor ?? "#ffffff";
  const headerTitle = design?.headerTitle ?? "ÁRAJÁNLAT";
  const accent = design?.accentColor ?? "#2563eb";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">
        PDF megjelenés
      </h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Fejléc szöveg
          </label>
          <input
            type="text"
            value={headerTitle}
            onChange={(e) =>
              onChange({ ...design, headerTitle: e.target.value })
            }
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Pl. ÁRAJÁNLAT"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Fejléc sáv színe
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ACCENT.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...design, accentColor: value })}
                className={`rounded border px-2 py-1 text-xs font-medium ${
                  accent === value
                    ? "border-gray-700 bg-gray-200 ring-1 ring-gray-400"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
            <label className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1">
              <input
                type="color"
                value={accent}
                onChange={(e) =>
                  onChange({ ...design, accentColor: e.target.value })
                }
                className="h-5 w-8 cursor-pointer rounded border-0 p-0"
              />
              <span className="text-xs text-gray-600">Egyéni</span>
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Háttér szín
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_BG.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  onChange({ ...design, backgroundColor: value })
                }
                className={`rounded border px-2 py-1 text-xs font-medium ${
                  bg === value
                    ? "border-gray-700 bg-gray-200 ring-1 ring-gray-400"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
            <label className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1">
              <input
                type="color"
                value={bg}
                onChange={(e) =>
                  onChange({ ...design, backgroundColor: e.target.value })
                }
                className="h-5 w-8 cursor-pointer rounded border-0 p-0"
              />
              <span className="text-xs text-gray-600">Egyéni</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
