"use client";

import { useState, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import Step1CompanyData from "@/components/Step1CompanyData";
import Step2ClientData from "@/components/Step2ClientData";
import Step2GeneralNote from "@/components/Step2GeneralNote";
import Step3Items from "@/components/Step3Items";
import Summary from "@/components/Summary";
import OffersList from "@/components/OffersList";
import {
  formSchema,
  formSchemaShape,
  createEmptyItem,
  getClientDisplayName,
  type FormData,
  type CompanyData,
  type ClientData,
  type ItemData,
  type SavedOffer,
} from "@/lib/schema";
import {
  getNextOfferId,
  saveNewOffer,
  updateOffer,
} from "@/lib/offersStorage";
import type { z } from "zod";

const STEPS = [
  "Cégadatok",
  "Megrendelő adatai",
  "Általános információ",
  "Tételek",
  "Összegzés",
] as const;

const INITIAL_DATA: FormData = {
  company: {
    companyName: "",
    address: "",
    phone: "",
    taxNumber: "",
    bankAccount: "",
    email: "",
    logoDataUrl: undefined,
    quotePreparedBy: "",
  },
  client: {
    kind: "individual",
    personName: "",
    address: "",
    email: "",
    phone: "",
  },
  generalNote: "",
  validityExpiry: "",
  rooms: [],
  items: [createEmptyItem("item-0")],
  hasDiscount: false,
  discountPercent: 0,
  isItemized: true,
  manualNetTotal: undefined,
  manualGrossTotal: undefined,
  priceDisclaimer: "labor_only",
  pdfDesign: {
    backgroundColor: "#ffffff",
    headerTitle: "ÁRAJÁNLAT",
    accentColor: "#2563eb",
  },
};

type FieldErrors = {
  company?: Partial<Record<keyof CompanyData, string>>;
  client?: Partial<{ companyName: string; taxNumber: string; personName: string; email: string }>;
  items?: Partial<Record<string, Partial<Record<keyof ItemData, string>>>>;
  discountPercent?: string;
  manualNetTotal?: string;
  manualGrossTotal?: string;
};

function getFieldErrors(err: z.ZodError, items: ItemData[] | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const e of err.errors) {
    const path = e.path;
    if (path[0] === "company" && path[1] !== undefined) {
      out.company = out.company ?? {};
      out.company[path[1] as keyof CompanyData] = e.message;
    } else if (path[0] === "client" && typeof path[1] === "string") {
      out.client = out.client ?? {};
      (out.client as Record<string, string>)[path[1]] = e.message;
    } else if (path[0] === "items" && typeof path[1] === "number") {
      const item = (items ?? [])[path[1]];
      if (item && path[2] !== undefined) {
        const id = item.id;
        out.items = out.items ?? {};
        out.items[id] = out.items[id] ?? {};
        (out.items[id] as Record<string, string>)[path[2] as string] = e.message;
      }
    } else if (path[0] === "discountPercent") {
      out.discountPercent = e.message;
    } else if (path[0] === "manualNetTotal") {
      out.manualNetTotal = e.message;
    } else if (path[0] === "manualGrossTotal") {
      out.manualGrossTotal = e.message;
    }
  }
  return out;
}

function offerToFormData(offer: SavedOffer): FormData {
  const client = (() => {
    const c = offer.client as ClientData & { name?: string } | undefined;
    if (!c) return INITIAL_DATA.client;
    if (c.kind === "company" || c.kind === "individual") return offer.client as ClientData;
    const legacy = c as { name?: string; address?: string; phone?: string; email?: string };
    if (legacy.name != null) {
      return {
        kind: "individual" as const,
        personName: legacy.name,
        address: legacy.address ?? "",
        phone: legacy.phone ?? "",
        email: legacy.email ?? "",
      };
    }
    return INITIAL_DATA.client;
  })();
  return {
    company: offer.company ?? INITIAL_DATA.company,
    client: client ?? INITIAL_DATA.client,
    offerId: offer.offerId,
    generalNote: offer.generalNote ?? "",
    validityExpiry: offer.validityExpiry ?? "",
    rooms: Array.isArray(offer.rooms)
      ? offer.rooms.map((r, i) => ({ ...r, order: r.order ?? i }))
      : [],
    items: Array.isArray(offer.items) && offer.items.length > 0 ? offer.items : INITIAL_DATA.items,
    hasDiscount: offer.hasDiscount,
    discountPercent: offer.discountPercent,
    isItemized: offer.isItemized ?? true,
    manualNetTotal: offer.manualNetTotal,
    manualGrossTotal: offer.manualGrossTotal,
    priceDisclaimer: offer.priceDisclaimer ?? "labor_only",
    pdfDesign: offer.pdfDesign ?? INITIAL_DATA.pdfDesign,
  };
}

export default function Home() {
  const [view, setView] = useState<"wizard" | "list">("wizard");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [listPdfError, setListPdfError] = useState<string | null>(null);
  const [listPdfLoadingId, setListPdfLoadingId] = useState<string | null>(null);
  const [offersRefreshKey, setOffersRefreshKey] = useState(0);

  useEffect(() => {
    if (view === "wizard" && step === 1 && !data.offerId && !editingOfferId) {
      setData((prev) => ({ ...prev, offerId: getNextOfferId() }));
    }
  }, [view, step, data.offerId, editingOfferId]);

  const validateStep = useCallback(
    (targetStep: number): boolean => {
      if (targetStep <= 0) return true;
      if (targetStep === 1) {
        const result = formSchemaShape.company.safeParse(data.company);
        if (!result.success) {
          setErrors((prev) => ({
            ...prev,
            company: result.error.errors.reduce(
              (acc, e) => ({ ...acc, [e.path[0]]: e.message }),
              {} as Partial<Record<keyof CompanyData, string>>
            ),
          }));
          return false;
        }
        setErrors((prev) => ({ ...prev, company: undefined }));
        return true;
      }
      if (targetStep === 2) {
        const result = formSchemaShape.client.safeParse(data?.client ?? INITIAL_DATA.client);
        if (!result.success) {
          setErrors((prev) => ({
            ...prev,
            client: result.error.errors.reduce(
              (acc, e) => ({ ...acc, [e.path[0]]: e.message }),
              {} as Partial<Record<keyof ClientData, string>>
            ),
          }));
          return false;
        }
        setErrors((prev) => ({ ...prev, client: undefined }));
        return true;
      }
      if (targetStep === 3) return true;
      if (targetStep === 4) {
        let items = data?.items ?? INITIAL_DATA.items;
        if (!data?.isItemized) {
          const cleaned = items.filter(
            (i) => (i.name?.trim() ?? "") !== "" || ((i.subItems?.length ?? 0) > 0)
          );
          if (cleaned.length >= 1) {
            items = cleaned;
            setData((prev) => ({ ...prev, items: cleaned }));
          }
        }
        const result = formSchemaShape.items.safeParse(items);
        if (!result.success) {
          const fieldErrs = getFieldErrors(result.error, items);
          setErrors((prev) => ({ ...prev, items: fieldErrs.items }));
          return false;
        }
        setErrors((prev) => ({ ...prev, items: undefined }));
        return true;
      }
      if (targetStep === 5) {
        const full = formSchema.safeParse(data);
        if (!full.success) {
          setErrors(getFieldErrors(full.error, data?.items ?? []));
          return false;
        }
        setErrors({});
        return true;
      }
      return true;
    },
    [data]
  );

  const goNext = () => {
    if (step === 0 && !data.offerId && !editingOfferId) {
      setData((prev) => ({ ...prev, offerId: getNextOfferId() }));
    }
    if (validateStep(step + 1)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const goPrev = () => {
    setStep((s) => Math.max(s - 1, 0));
    setErrors({});
    setPdfError(null);
    setPdfSuccess(false);
  };

  const handleExportPdf = async () => {
    setPdfError(null);
    setPdfSuccess(false);
    flushSync(() => setPdfLoading(true));
    const parsed = formSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error, data?.items ?? []));
      setStep(STEPS.length - 1);
      setPdfError("Kérjük, töltse ki az összes kötelező mezőt.");
      setPdfLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const pdfUrl = URL.createObjectURL(blob);
      setPdfError(null);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 5000);
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.download = `${parsed.data.offerId ?? "ajanlat"}_${getClientDisplayName(parsed.data.client).replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "ajanlat"}.pdf`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 300);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ismeretlen hiba a PDF készítésekor.";
      setPdfError(message);
    } finally {
      setPdfLoading(false);
    }
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveError(null);
    const hasContent = (s: string | undefined) => {
      const t = (s ?? "").trim().replace(/\u200B|\u200C|\u200D|\uFEFF/g, "");
      return t.length > 0 && t !== "—" && t !== "–" && t !== "-";
    };
    const nonEmptyItems = (data.items ?? []).filter(
      (i) =>
        hasContent(i.name) ||
        hasContent(i.note) ||
        (i.subItems ?? []).some((s) => hasContent(s.name))
    );
    if (nonEmptyItems.length === 0) {
      setSaveError("Legalább egy kitöltött tétel szükséges a mentéshez. Töltse ki a tétel nevét vagy megjegyzését.");
      setStep(STEPS.length - 1);
      return;
    }
    const dataToValidate = { ...data, items: nonEmptyItems };
    const parsed = formSchema.safeParse(dataToValidate);
    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error, nonEmptyItems));
      setStep(STEPS.length - 1);
      setSaveError("Kérjük, töltse ki a kötelező mezőket (cégadatok, megrendelő, tételek).");
      return;
    }
    setSaveLoading(true);
    try {
      const offerId = data.offerId ?? getNextOfferId();
      const payload = {
        company: parsed.data.company,
        client: parsed.data.client,
        offerId,
        generalNote: parsed.data.generalNote,
        validityExpiry: parsed.data.validityExpiry || undefined,
        items: parsed.data.items,
        hasDiscount: parsed.data.hasDiscount,
        discountPercent: parsed.data.discountPercent ?? 0,
        pdfDesign: parsed.data.pdfDesign,
        isItemized: parsed.data.isItemized ?? true,
        rooms: parsed.data.rooms,
        manualNetTotal: parsed.data.manualNetTotal,
        manualGrossTotal: parsed.data.manualGrossTotal,
        priceDisclaimer: parsed.data.priceDisclaimer ?? "labor_only",
      };
      if (editingOfferId) {
        updateOffer(editingOfferId, payload);
      } else {
        saveNewOffer(payload);
      }
      setOffersRefreshKey((k) => k + 1);
      setView("list");
      setEditingOfferId(null);
      setData(INITIAL_DATA);
      setStep(0);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEdit = (offer: SavedOffer) => {
    setData(offerToFormData(offer));
    setEditingOfferId(offer.id);
    setStep(0);
    setErrors({});
    setSaveError(null);
    setView("wizard");
  };

  const handleExportPdfFromList = async (offer: SavedOffer) => {
    setListPdfError(null);
    setListPdfLoadingId(offer.id);
    try {
      const formData = offerToFormData(offer);
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const pdfUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.download = `${offer.offerId}_${getClientDisplayName(offer.client).replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "ajanlat"}.pdf`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 200);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 15000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "A PDF generálás sikertelen.";
      setListPdfError(msg);
      setTimeout(() => setListPdfError(null), 6000);
    } finally {
      setListPdfLoadingId(null);
    }
  };

  const startNewOffer = () => {
    setData(INITIAL_DATA);
    setEditingOfferId(null);
    setStep(0);
    setErrors({});
    setView("wizard");
  };

  if (view === "list") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <nav className="mb-6 flex gap-2 border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={startNewOffer}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Új árajánlat
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Ajánlatok
          </button>
        </nav>
        <OffersList
          key={offersRefreshKey}
          onEdit={handleEdit}
          onExportPdf={handleExportPdfFromList}
          pdfError={listPdfError}
          pdfLoadingId={listPdfLoadingId}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 flex gap-2 border-b border-gray-200 pb-4">
        <button
          type="button"
          onClick={startNewOffer}
          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Új árajánlat
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ajánlatok
        </button>
      </nav>

      <h1 className="mb-8 text-2xl font-bold text-gray-900">
        {editingOfferId ? "Ajánlat módosítása" : "Új árajánlat"}
      </h1>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (i < step) {
                setStep(i);
                setErrors({});
                setPdfError(null);
                setPdfSuccess(false);
              } else if (i > step && validateStep(i)) {
                setStep(i);
                setPdfError(null);
                setPdfSuccess(false);
              }
            }}
            className={`rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              i === step
                ? "bg-blue-600 text-white"
                : i < step
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {pdfError && step === 4 && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {pdfError}
          </div>
        )}
        {saveError && step === 4 && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}
        {pdfSuccess && step === 4 && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            PDF elkészült – új lapon nyílt. Mentsd el onnan: Ctrl+S vagy Fájl → Mentés.
          </div>
        )}
        {step === 0 && (
          <Step1CompanyData
            data={data.company}
            onChange={(company) => setData((d) => ({ ...d, company }))}
            errors={errors.company ?? {}}
          />
        )}
        {step === 1 && (
          <Step2ClientData
            data={data.client}
            onChange={(client) => setData((d) => ({ ...d, client }))}
            offerId={data.offerId}
            errors={errors.client ?? {}}
          />
        )}
        {step === 2 && (
          <Step2GeneralNote
            value={data.generalNote}
            onChange={(generalNote) => setData((d) => ({ ...d, generalNote }))}
            validityExpiry={data.validityExpiry ?? ""}
            onValidityExpiryChange={(validityExpiry) => setData((d) => ({ ...d, validityExpiry }))}
          />
        )}
        {step === 3 && (
          <>
            {errors.items && Object.keys(errors.items).length > 0 && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Nem lehet továbblépni – kérjük javítsa a hibákat:</p>
                <ul className="mt-1 list-inside list-disc">
                  {Object.entries(errors.items)
                    .flatMap(([id, errs]) =>
                      errs && typeof errs === "object"
                        ? Object.values(errs).map((msg) => (
                            <li key={`${id}-${String(msg)}`}>{msg}</li>
                          ))
                        : []
                    )}
                </ul>
                <p className="mt-2 text-xs">
                  Üres tételek törléséhez kattintson a tétel melletti × gombra, vagy töltse ki a „Fő tétel” mezőt.
                </p>
              </div>
            )}
            <Step3Items
            items={data.items}
            onItemsChange={(items) => setData((d) => ({ ...d, items }))}
            rooms={data.rooms ?? []}
            onRoomsChange={(rooms) => setData((d) => ({ ...d, rooms }))}
            isItemized={data.isItemized ?? true}
            onIsItemizedChange={(v) => setData((d) => ({ ...d, isItemized: v }))}
            errors={errors.items ?? {}}
          />
          </>
        )}
        {step === 4 && (
          <Summary
            data={data}
            onDataChange={setData}
            errors={{
              discountPercent: errors.discountPercent,
              manualNetTotal: errors.manualNetTotal,
              manualGrossTotal: errors.manualGrossTotal,
            }}
            onExportPdf={handleExportPdf}
            onSave={handleSave}
            pdfLoading={pdfLoading}
            pdfSuccess={pdfSuccess}
            saveLoading={saveLoading}
          />
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 0}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Előző
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Következő
          </button>
        ) : null}
      </div>
    </main>
  );
}
