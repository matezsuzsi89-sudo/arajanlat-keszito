"use client";

import type { ClientData } from "@/lib/schema";

type ClientErrors = Partial<{
  companyName: string;
  taxNumber: string;
  personName: string;
  email: string;
}>;

type Props = {
  data: ClientData;
  onChange: (data: ClientData) => void;
  offerId: string | undefined;
  errors: ClientErrors;
};

export default function Step2ClientData({ data, onChange, errors, offerId }: Props) {
  const setKind = (kind: "company" | "individual") => {
    if (data.kind === kind) return;
    if (kind === "company") {
      onChange({
        kind: "company",
        companyName: "",
        taxNumber: "",
        address: data.address ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
      });
    } else {
      onChange({
        kind: "individual",
        personName: "",
        address: data.address ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
      });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Megrendelő adatai</h2>

      {offerId && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3">
          <label className="text-xs font-medium text-blue-800">Ajánlat azonosító</label>
          <p className="text-lg font-mono font-semibold text-blue-900">{offerId}</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Megrendelő típusa
        </label>
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                data.kind === "company"
                  ? "border-blue-600 bg-blue-600"
                  : "border-gray-300 bg-white"
              }`}
            >
              {data.kind === "company" && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>
            <input
              type="radio"
              name="clientKind"
              checked={data.kind === "company"}
              onChange={() => setKind("company")}
              className="sr-only"
            />
            <span className="text-sm text-gray-700">Cég</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                data.kind === "individual"
                  ? "border-blue-600 bg-blue-600"
                  : "border-gray-300 bg-white"
              }`}
            >
              {data.kind === "individual" && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>
            <input
              type="radio"
              name="clientKind"
              checked={data.kind === "individual"}
              onChange={() => setKind("individual")}
              className="sr-only"
            />
            <span className="text-sm text-gray-700">Magánszemély</span>
          </label>
        </div>
      </div>

      {data.kind === "company" ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cégnév
            </label>
            <input
              type="text"
              value={data.companyName}
              onChange={(e) =>
                onChange({ ...data, companyName: e.target.value })
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Pl. Kiss János Kft."
            />
            {errors.companyName && (
              <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Adószám
            </label>
            <input
              type="text"
              value={data.taxNumber}
              onChange={(e) =>
                onChange({ ...data, taxNumber: e.target.value })
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="12345678-1-12"
            />
            {errors.taxNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.taxNumber}</p>
            )}
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Név
          </label>
          <input
            type="text"
            value={data.personName}
            onChange={(e) =>
              onChange({ ...data, personName: e.target.value })
            }
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Pl. Kiss János"
          />
          {errors.personName && (
            <p className="mt-1 text-sm text-red-600">{errors.personName}</p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Cím (opcionális)
        </label>
        <input
          type="text"
          value={data.address ?? ""}
          onChange={(e) =>
            onChange({ ...data, address: e.target.value })
          }
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Pl. 1234 Budapest, Példa u. 1."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Telefon (opcionális)
        </label>
        <input
          type="tel"
          value={data.phone ?? ""}
          onChange={(e) =>
            onChange({ ...data, phone: e.target.value })
          }
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="+36 1 234 5678"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          E-mail (opcionális)
        </label>
        <input
          type="email"
          value={data.email ?? ""}
          onChange={(e) =>
            onChange({ ...data, email: e.target.value })
          }
          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="email@pelda.hu"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>
    </div>
  );
}
