"use client";

import { useState, useMemo } from "react";
import type { SavedOffer } from "@/lib/schema";
import { getClientDisplayName } from "@/lib/schema";
import { getOffers, deleteOffer } from "@/lib/offersStorage";

type Props = {
  onEdit: (offer: SavedOffer) => void;
  onExportPdf: (offer: SavedOffer) => void;
  pdfError?: string | null;
  pdfLoadingId?: string | null;
};

export default function OffersList({ onEdit, onExportPdf, pdfError, pdfLoadingId }: Props) {
  const [offers, setOffers] = useState<SavedOffer[]>(() => getOffers());
  const [filterCompany, setFilterCompany] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const companyNames = useMemo(() => {
    const set = new Set(offers.map((o) => o.company.companyName).filter(Boolean));
    return Array.from(set).sort();
  }, [offers]);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (filterCompany && o.company.companyName !== filterCompany) return false;
      if (!filterClient) return true;
      const q = filterClient.toLowerCase();
      const clientName = getClientDisplayName(o.client).toLowerCase();
      return (
        clientName.includes(q) ||
        o.offerId.toLowerCase().includes(q) ||
        (o.client.address?.toLowerCase().includes(q) ?? false) ||
        (o.client.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [offers, filterCompany, filterClient]);

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && window.confirm("Töröljük ezt az ajánlatot?")) {
      deleteOffer(id);
      setOffers(getOffers());
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Ajánlatok</h2>

      {pdfError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {pdfError}
        </div>
      )}

      <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Szűrés: ajánlatot adó cég
          </label>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Összes cég</option>
            {companyNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Szűrés: megrendelő vagy azonosító
          </label>
          <input
            type="text"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            placeholder="Megrendelő neve, AJA-2025-0001..."
            className="w-64 rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          {offers.length === 0
            ? "Még nincs mentett ajánlat. Hozz létre egyet az „Új árajánlat” menüpontban."
            : "Nincs a szűrésnek megfelelő ajánlat."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">
                  Azonosító
                </th>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">
                  Megrendelő
                </th>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">
                  Ajánlatot adó cég
                </th>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">
                  Módosítva
                </th>
                <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((offer) => (
                <tr key={offer.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-800">{offer.offerId}</td>
                  <td className="px-3 py-2">{getClientDisplayName(offer.client)}</td>
                  <td className="px-3 py-2 text-gray-600">{offer.company.companyName}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(offer.updatedAt).toLocaleDateString("hu-HU")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(offer)}
                      className="mr-2 rounded bg-blue-100 px-2 py-1 text-blue-800 hover:bg-blue-200"
                    >
                      Módosítás
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportPdf(offer)}
                      disabled={pdfLoadingId === offer.id}
                      className="mr-2 rounded bg-green-100 px-2 py-1 text-green-800 hover:bg-green-200 disabled:opacity-70"
                    >
                      {pdfLoadingId === offer.id ? "PDF készül…" : "PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(offer.id)}
                      className="rounded bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200"
                    >
                      Törlés
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
