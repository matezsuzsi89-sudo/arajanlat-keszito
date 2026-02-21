"use client";

import type { CompanyData } from "@/lib/schema";

type Props = {
  data: CompanyData;
  onChange: (data: CompanyData) => void;
  errors: Partial<Record<keyof CompanyData, string>>;
};

export default function Step1CompanyData({ data, onChange, errors }: Props) {
  const handleChange = (field: keyof CompanyData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ ...data, [field]: e.target.value });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...data, logoDataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Cégadatok</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Cégnév
        </label>
        <input
          type="text"
          value={data.companyName}
          onChange={handleChange("companyName")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Pl. Kft. Példa"
        />
        {errors.companyName && (
          <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Cím
        </label>
        <input
          type="text"
          value={data.address}
          onChange={handleChange("address")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Pl. 1234 Budapest, Példa u. 1."
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Telefonszám
        </label>
        <input
          type="tel"
          value={data.phone}
          onChange={handleChange("phone")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="+36 1 234 5678"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Adószám
        </label>
        <input
          type="text"
          value={data.taxNumber}
          onChange={handleChange("taxNumber")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="12345678-1-12"
        />
        {errors.taxNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.taxNumber}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Bankszámlaszám
        </label>
        <input
          type="text"
          value={data.bankAccount}
          onChange={handleChange("bankAccount")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="12345678-12345678-12345678"
        />
        {errors.bankAccount && (
          <p className="mt-1 text-sm text-red-600">{errors.bankAccount}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          E-mail (opcionális)
        </label>
        <input
          type="email"
          value={data.email ?? ""}
          onChange={handleChange("email")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="info@ceg.hu"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Árajánlatot készítette (opcionális)
        </label>
        <input
          type="text"
          value={data.quotePreparedBy ?? ""}
          onChange={handleChange("quotePreparedBy")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Pl. Nagy János"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Logó feltöltése
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700"
        />
        {data.logoDataUrl && (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={data.logoDataUrl}
              alt="Logó"
              className="h-20 object-contain"
            />
            <button
              type="button"
              onClick={() => onChange({ ...data, logoDataUrl: undefined })}
              className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 focus:outline-none"
            >
              Logó törlése
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
