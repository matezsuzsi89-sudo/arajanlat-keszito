import { z } from "zod";

export const companySchema = z.object({
  companyName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxNumber: z.string().optional(),
  bankAccount: z.string().optional(),
  email: z
    .union([z.string().email("Érvényes e-mail cím"), z.literal("")])
    .optional(),
  logoDataUrl: z.string().optional(),
  quotePreparedBy: z.string().optional(),
});

export const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().optional(),
});

export const subItemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "A tétel neve kötelező"),
  note: z.string().optional(),
  quantity: z.number().min(0, "A mennyiség nem lehet negatív"),
  unit: z.string().min(1, "A mértékegység kötelező"),
  netUnitPrice: z.number().min(0, "A nettó egységár nem lehet negatív"),
  vatPercent: z.number().min(0, "Az ÁFA % nem lehet negatív"),
  subItems: z.array(subItemSchema).optional(),
  roomId: z.string().optional(),
});

const emailOptional = z
  .union([z.string().email("Érvényes e-mail"), z.literal("")])
  .optional();

export const clientSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("company"),
    companyName: z.string().optional(),
    taxNumber: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: emailOptional,
  }),
  z.object({
    kind: z.literal("individual"),
    personName: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: emailOptional,
  }),
]);

export function getClientDisplayName(client: ClientData): string {
  if ("kind" in client) {
    if (client.kind === "company") return client.companyName ?? "";
    return client.personName ?? "";
  }
  if ("name" in client && typeof (client as { name?: string }).name === "string") {
    return (client as { name: string }).name;
  }
  return "";
}

export const pdfDesignSchema = z.object({
  backgroundColor: z.string().optional(),
  headerTitle: z.string().optional(),
  accentColor: z.string().optional(),
});

const formSchemaBase = z.object({
  company: companySchema,
  client: clientSchema,
  offerId: z.string().optional(),
  generalNote: z.string(),
  validityExpiry: z.string().optional(),
  rooms: z.array(roomSchema).optional(),
  items: z.array(itemSchema).min(1, "Legalább egy tétel szükséges"),
  hasDiscount: z.boolean(),
  discountPercent: z.number().min(0).max(100).optional(),
  pdfDesign: pdfDesignSchema.optional(),
  isItemized: z.boolean(),
  manualNetTotal: z.number().min(0).optional(),
  manualGrossTotal: z.number().min(0).optional(),
  priceDisclaimer: z.enum(["labor_only", "material_and_labor"]).optional(),
});

/** Lépésenkénti validációhoz (formSchema.shape nincs superRefine után) */
export const formSchemaShape = formSchemaBase.shape;

export const formSchema = formSchemaBase;

export type PdfDesign = z.infer<typeof pdfDesignSchema>;
export type CompanyData = z.infer<typeof companySchema>;
export type RoomData = z.infer<typeof roomSchema>;
export type ClientData = z.infer<typeof clientSchema>;
export type SubItemData = z.infer<typeof subItemSchema>;
export type ItemData = z.infer<typeof itemSchema>;
export type FormData = z.infer<typeof formSchema>;

export interface SavedOffer {
  id: string;
  offerId: string;
  company: CompanyData;
  client: ClientData;
  generalNote: string;
  validityExpiry?: string;
  rooms?: RoomData[];
  items: ItemData[];
  hasDiscount: boolean;
  discountPercent: number;
  pdfDesign?: PdfDesign;
  isItemized?: boolean;
  manualNetTotal?: number;
  manualGrossTotal?: number;
  priceDisclaimer?: "labor_only" | "material_and_labor";
  createdAt: string;
  updatedAt: string;
}

export function createEmptyItem(id: string): ItemData {
  return {
    id,
    name: "",
    note: "",
    quantity: 0,
    unit: "db",
    netUnitPrice: 0,
    vatPercent: 27,
    subItems: [],
  };
}

export function createEmptySubItem(id: string): SubItemData {
  return { id, name: "" };
}

export function createEmptyRoom(id: string, order?: number): RoomData {
  return { id, name: "", order };
}

/** Helyiségek létrehozási sorrendben (order szerint, ha nincs order akkor index szerint) */
export function getRoomsInOrder(rooms: RoomData[]): RoomData[] {
  return [...rooms].sort((a, b) => {
    const orderA = a.order ?? rooms.indexOf(a);
    const orderB = b.order ?? rooms.indexOf(b);
    return orderA - orderB;
  });
}

/** Csoportosítja a tételeket helyiség szerint. A helyiségek létrehozási sorrendjében jelennek meg, a helyiség nélküli tételek az Egyéb csoportban a végén. */
export function groupItemsByRoom(
  items: ItemData[],
  rooms: RoomData[] = []
): { roomId: string | null; roomName: string; items: ItemData[] }[] {
  const orderedRooms = getRoomsInOrder(rooms);
  const validRoomIds = new Set(rooms.map((r) => r.id));
  const byRoom = new Map<string | null, ItemData[]>();
  for (const item of items) {
    const rid =
      item.roomId && validRoomIds.has(item.roomId) ? item.roomId : null;
    if (!byRoom.has(rid)) byRoom.set(rid, []);
    byRoom.get(rid)!.push(item);
  }
  const result: { roomId: string | null; roomName: string; items: ItemData[] }[] = [];
  for (const r of orderedRooms) {
    const roomItems = byRoom.get(r.id);
    if (roomItems && roomItems.length > 0) {
      result.push({ roomId: r.id, roomName: r.name, items: roomItems });
    }
  }
  const uncategorized = byRoom.get(null) ?? [];
  if (uncategorized.length > 0) {
    result.push({ roomId: null, roomName: "Egyéb", items: uncategorized });
  }
  return result;
}

export function getItemNetTotal(item: ItemData): number {
  return item.quantity * item.netUnitPrice;
}

export function getItemGrossTotal(item: ItemData): number {
  const net = getItemNetTotal(item);
  return net * (1 + item.vatPercent / 100);
}

export function getTotals(items: ItemData[]) {
  const netSubtotal = items.reduce((sum, i) => sum + getItemNetTotal(i), 0);
  const grossSubtotal = items.reduce((sum, i) => sum + getItemGrossTotal(i), 0);
  const vatTotal = grossSubtotal - netSubtotal;
  return { netSubtotal, grossSubtotal, vatTotal };
}

export function getDiscountAmount(grossTotal: number, discountPercent: number): number {
  return (grossTotal * discountPercent) / 100;
}

export function getFinalTotal(grossTotal: number, discountPercent: number): number {
  return grossTotal - getDiscountAmount(grossTotal, discountPercent);
}
