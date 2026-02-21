import type { SavedOffer } from "./schema";

const STORAGE_KEY = "arajánlat-offers";

function loadOffers(): SavedOffer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || typeof raw !== "string") return [];
    const trimmed = raw.trim();
    if (!trimmed || (trimmed[0] !== "[" && trimmed[0] !== "{")) return [];
    const parsed = JSON.parse(raw) as SavedOffer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOffers(offers: SavedOffer[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
}

export function getOffers(): SavedOffer[] {
  return loadOffers();
}

export function getOfferById(id: string): SavedOffer | undefined {
  return loadOffers().find((o) => o.id === id);
}

export function getNextOfferId(): string {
  const offers = loadOffers();
  const year = new Date().getFullYear();
  const sameYear = offers.filter((o) => o.offerId.startsWith(`AJA-${year}-`));
  const numbers = sameYear
    .map((o) => parseInt(o.offerId.replace(`AJA-${year}-`, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `AJA-${year}-${String(next).padStart(4, "0")}`;
}

function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function saveNewOffer(offer: Omit<SavedOffer, "id" | "createdAt" | "updatedAt">): SavedOffer {
  const offers = loadOffers();
  const now = new Date().toISOString();
  const newOffer: SavedOffer = {
    ...offer,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  offers.unshift(newOffer);
  saveOffers(offers);
  return newOffer;
}

export function updateOffer(id: string, offer: Omit<SavedOffer, "id" | "createdAt" | "updatedAt">): void {
  const offers = loadOffers();
  const idx = offers.findIndex((o) => o.id === id);
  if (idx === -1) return;
  const existing = offers[idx];
  const updated: SavedOffer = {
    ...offer,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  offers[idx] = updated;
  saveOffers(offers);
}

export function deleteOffer(id: string): void {
  const offers = loadOffers().filter((o) => o.id !== id);
  saveOffers(offers);
}
