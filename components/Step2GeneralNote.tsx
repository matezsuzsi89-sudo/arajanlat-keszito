"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  validityExpiry?: string;
  onValidityExpiryChange?: (value: string) => void;
};

export default function Step2GeneralNote({ value, onChange, validityExpiry = "", onValidityExpiryChange }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">
        Általános információ
      </h2>
      <p className="text-sm text-gray-600">
        Pl. gyártási idő, fizetési feltételek, ajánlat érvényessége.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Írja ide az általános információkat..."
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Érvényesség lejárata
        </label>
        <input
          type="date"
          value={validityExpiry}
          onChange={(e) => onValidityExpiryChange?.(e.target.value)}
          className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
