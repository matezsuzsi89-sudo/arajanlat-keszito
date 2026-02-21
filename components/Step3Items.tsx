"use client";

import { Fragment, useEffect, useState } from "react";
import type { ItemData, RoomData, SubItemData } from "@/lib/schema";
import {
  createEmptyItem,
  createEmptyRoom,
  createEmptySubItem,
  getItemNetTotal,
  getItemGrossTotal,
  getRoomsInOrder,
} from "@/lib/schema";

const VAT_OPTIONS = [0, 5, 27];

function DragHandle({
  onDragStart,
  isDragging,
}: {
  onDragStart: (e: React.DragEvent) => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(e);
      }}
      className={`cursor-grab select-none rounded px-1.5 py-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
      title="Húzza a tétel áthelyezéséhez"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") e.preventDefault();
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-4 w-4 pointer-events-none"
        draggable={false}
      >
        <path d="M8 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm6-12a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </div>
  );
}

type Props = {
  items: ItemData[];
  onItemsChange: (items: ItemData[]) => void;
  rooms: RoomData[];
  onRoomsChange: (rooms: RoomData[]) => void;
  isItemized: boolean;
  onIsItemizedChange: (value: boolean) => void;
  errors: Partial<Record<string, Record<keyof ItemData, string>>>;
};

export default function Step3Items({ items, onItemsChange, rooms, onRoomsChange, isItemized, onIsItemizedChange, errors }: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const itemsInActiveTab = activeTabId === null
    ? items.filter((i) => !i.roomId)
    : items.filter((i) => i.roomId === activeTabId);

  const getFlatIndex = (item: ItemData) => items.findIndex((x) => x.id === item.id);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= items.length) return;
    const next = [...items];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    onItemsChange(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    try {
      const img = new Image();
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch (_) {}
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedIndex(null);
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIndex)) moveItem(fromIndex, toIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addItem = () => {
    const id = `item-${Date.now()}`;
    const newItem = createEmptyItem(id);
    const withRoom = rooms.length > 0 ? { ...newItem, roomId: activeTabId ?? undefined } : newItem;
    onItemsChange([...items, withRoom]);
  };

  const updateItem = (index: number, updates: Partial<ItemData>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onItemsChange(next);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const addSubItem = (itemIndex: number) => {
    const item = items[itemIndex];
    const subs = item.subItems ?? [];
    const newSub = createEmptySubItem(`sub-${Date.now()}-${itemIndex}`);
    updateItem(itemIndex, { subItems: [...subs, newSub] });
  };

  const updateSubItem = (itemIndex: number, subIndex: number, name: string) => {
    const item = items[itemIndex];
    const subs = [...(item.subItems ?? [])];
    subs[subIndex] = { ...subs[subIndex], name };
    updateItem(itemIndex, { subItems: subs });
  };

  const removeSubItem = (itemIndex: number, subIndex: number) => {
    const item = items[itemIndex];
    const subs = (item.subItems ?? []).filter((_, i) => i !== subIndex);
    updateItem(itemIndex, { subItems: subs });
  };

  const addRoom = () => {
    const newRoom = createEmptyRoom(`room-${Date.now()}`, rooms.length);
    onRoomsChange([...rooms, newRoom]);
    setActiveTabId(newRoom.id);
  };

  const updateRoom = (index: number, name: string) => {
    const next = [...rooms];
    next[index] = { ...next[index], name };
    onRoomsChange(next);
  };

  const removeRoom = (index: number) => {
    const removed = rooms[index];
    const newRooms = rooms.filter((_, i) => i !== index);
    onRoomsChange(newRooms);
    items.forEach((item, i) => {
      if (item.roomId === removed.id) updateItem(i, { roomId: undefined });
    });
    if (activeTabId === removed.id) {
      setActiveTabId(newRooms.length > 0 ? newRooms[0].id : null);
    }
  };

  const moveRoom = (orderedIndex: number, direction: -1 | 1) => {
    const ordered = getRoomsInOrder(rooms);
    const toIdx = orderedIndex + direction;
    if (toIdx < 0 || toIdx >= ordered.length) return;
    const roomA = ordered[orderedIndex];
    const roomB = ordered[toIdx];
    const next = rooms.map((r) => {
      if (r.id === roomA.id) return { ...r, order: toIdx };
      if (r.id === roomB.id) return { ...r, order: orderedIndex };
      return r;
    });
    onRoomsChange(next);
  };

  useEffect(() => {
    if (rooms.length > 0 && activeTabId !== null && !rooms.some((r) => r.id === activeTabId)) {
      setActiveTabId(rooms[0]?.id ?? null);
    }
  }, [rooms, activeTabId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Árajánlat típusa
          </label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="quoteType"
                checked={isItemized}
                onChange={() => onIsItemizedChange(true)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Tételes</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="quoteType"
                checked={!isItemized}
                onChange={() => onIsItemizedChange(false)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Nem tételes</span>
            </label>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800">Tételek</h2>

      {isItemized ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-8 border border-gray-300 px-1 py-2" title="Húzza a sorok átrendezéséhez" />
                {rooms.length > 0 && (
                  <th className="w-28 border border-gray-300 px-2 py-2 text-left font-medium">
                    Helyiség
                  </th>
                )}
                <th className="border border-gray-300 px-2 py-2 text-left font-medium">
                  Tétel neve *
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-medium">
                  Megjegyzés
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-medium w-24">
                  Mennyiség *
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-medium w-20">
                  Mértékegység *
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-medium w-28">
                  Nettó egységár *
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-medium w-20">
                  ÁFA %
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-medium w-24">
                  Nettó össz.
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-medium w-24">
                  Bruttó össz.
                </th>
                <th className="border border-gray-300 px-2 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {(rooms.length > 0 ? itemsInActiveTab : items).map((item) => {
                const index = getFlatIndex(item);
                    const netTotal = getItemNetTotal(item);
                    const grossTotal = getItemGrossTotal(item);
                    const itemErrors = errors[item.id];
                    return (
                      <tr
                        key={item.id}
                        className={`bg-white ${draggedIndex === index ? "opacity-60" : ""}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="border border-gray-300 px-1 py-1 align-top">
                          <div className="flex flex-col items-center gap-0.5">
                            <DragHandle
                              onDragStart={(e) => handleDragStart(e, index)}
                              isDragging={draggedIndex === index}
                            />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => {
                                  const idxInTab = itemsInActiveTab.findIndex((x) => x.id === item.id);
                                  const prevItem = idxInTab > 0 ? itemsInActiveTab[idxInTab - 1] : null;
                                  const prevFlat = prevItem ? getFlatIndex(prevItem) : -1;
                                  if (prevFlat >= 0) moveItem(index, prevFlat);
                                }}
                                disabled={itemsInActiveTab.findIndex((x) => x.id === item.id) === 0}
                                className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Fel"
                              >
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const idxInTab = itemsInActiveTab.findIndex((x) => x.id === item.id);
                                  const nextItem = idxInTab >= 0 && idxInTab < itemsInActiveTab.length - 1 ? itemsInActiveTab[idxInTab + 1] : null;
                                  const nextFlat = nextItem ? getFlatIndex(nextItem) : items.length;
                                  if (nextFlat < items.length) moveItem(index, nextFlat);
                                }}
                                disabled={itemsInActiveTab.findIndex((x) => x.id === item.id) === itemsInActiveTab.length - 1}
                                className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Le"
                              >
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                    {rooms.length > 0 && (
                      <td className="border border-gray-300 px-2 py-1">
                        <select
                          value={item.roomId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            updateItem(index, { roomId: val });
                            setActiveTabId(val ?? null);
                          }}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                        >
                          <option value="">Egyéb</option>
                          {getRoomsInOrder(rooms).map((r) => (
                            <option key={r.id} value={r.id}>{r.name || "(névtelen)"}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="border border-gray-300 px-2 py-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, { name: e.target.value })}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-gray-900 focus:border-blue-500 focus:outline-none"
                        placeholder="Tétel neve"
                      />
                      {itemErrors?.name && (
                        <p className="text-xs text-red-600">{itemErrors.name}</p>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      <input
                        type="text"
                        value={item.note ?? ""}
                        onChange={(e) =>
                          updateItem(index, { note: e.target.value || undefined })
                        }
                        className="w-full rounded border border-gray-200 px-2 py-1 text-gray-900 focus:border-blue-500 focus:outline-none"
                        placeholder="Megjegyzés"
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={item.quantity === 0 ? "" : item.quantity}
                        onChange={(e) =>
                          updateItem(index, {
                            quantity: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className="w-full rounded border border-gray-200 px-2 py-1 text-right text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                      {itemErrors?.quantity && (
                        <p className="text-xs text-red-600">{itemErrors.quantity}</p>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(index, { unit: e.target.value })}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-gray-900 focus:border-blue-500 focus:outline-none"
                        placeholder="db"
                      />
                      {itemErrors?.unit && (
                        <p className="text-xs text-red-600">{itemErrors.unit}</p>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.netUnitPrice === 0 ? "" : item.netUnitPrice}
                        onChange={(e) =>
                          updateItem(index, {
                            netUnitPrice: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className="w-full rounded border border-gray-200 px-2 py-1 text-right text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                      {itemErrors?.netUnitPrice && (
                        <p className="text-xs text-red-600">{itemErrors.netUnitPrice}</p>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <select
                        value={item.vatPercent}
                        onChange={(e) =>
                          updateItem(index, { vatPercent: Number(e.target.value) })
                        }
                        className="w-full rounded border border-gray-200 px-2 py-1 text-gray-900 focus:border-blue-500 focus:outline-none"
                      >
                        {VAT_OPTIONS.map((v) => (
                          <option key={v} value={v}>{v}%</option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                      {netTotal.toLocaleString("hu-HU")} Ft
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                      {grossTotal.toLocaleString("hu-HU")} Ft
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 hover:bg-red-200 focus:outline-none"
                        title="Tétel törlése"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {(rooms.length > 0 ? itemsInActiveTab : items).map((item) => {
            const index = getFlatIndex(item);
                const itemErrors = errors[item.id];
                const subItems = item.subItems ?? [];
                return (
              <div
                key={item.id}
                className={`rounded border border-gray-300 bg-white p-4 ${
                  draggedIndex === index ? "opacity-60" : ""
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="mb-3 flex items-start gap-2">
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1">
                    <DragHandle
                      onDragStart={(e) => handleDragStart(e, index)}
                      isDragging={draggedIndex === index}
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const idxInTab = itemsInActiveTab.findIndex((x) => x.id === item.id);
                          const prevItem = idxInTab > 0 ? itemsInActiveTab[idxInTab - 1] : null;
                          if (prevItem) moveItem(index, getFlatIndex(prevItem));
                        }}
                        disabled={itemsInActiveTab.findIndex((x) => x.id === item.id) === 0}
                        className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Fel"
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const idxInTab = itemsInActiveTab.findIndex((x) => x.id === item.id);
                          const nextItem = idxInTab >= 0 && idxInTab < itemsInActiveTab.length - 1 ? itemsInActiveTab[idxInTab + 1] : null;
                          if (nextItem) moveItem(index, getFlatIndex(nextItem));
                        }}
                        disabled={itemsInActiveTab.findIndex((x) => x.id === item.id) === itemsInActiveTab.length - 1}
                        className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Le"
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {rooms.length > 0 && (
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">Helyiség</label>
                        <select
                          value={item.roomId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            updateItem(index, { roomId: val });
                            setActiveTabId(val ?? null);
                          }}
                          className="rounded border border-gray-200 px-2 py-1 text-sm"
                        >
                          <option value="">Egyéb</option>
                          {getRoomsInOrder(rooms).map((r) => (
                            <option key={r.id} value={r.id}>{r.name || "(névtelen)"}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Fő tétel *
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, { name: e.target.value })}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="pl. Fürdőszoba felújítás"
                      />
                      {itemErrors?.name && (
                        <p className="mt-1 text-xs text-red-600">{itemErrors.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-gray-600">Megjegyzés</label>
                      <input
                        type="text"
                        value={item.note ?? ""}
                        onChange={(e) =>
                          updateItem(index, { note: e.target.value || undefined })
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Opcionális megjegyzés"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-6 rounded bg-red-100 px-2 py-1 text-sm text-red-700 hover:bg-red-200 focus:outline-none"
                    title="Fő tétel törlése"
                  >
                    ×
                  </button>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Részletezés (altételek)
                  </label>
                  <div className="space-y-2">
                    {subItems.map((sub, subIndex) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <span className="text-gray-500">–</span>
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) =>
                            updateSubItem(index, subIndex, e.target.value)
                          }
                          className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                          placeholder="pl. fugázás, csemperagsztás, tömítés..."
                        />
                        <button
                          type="button"
                          onClick={() => removeSubItem(index, subIndex)}
                          className="rounded bg-gray-100 px-2 py-1 text-gray-600 hover:bg-gray-200 focus:outline-none"
                          title="Altétel törlése"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addSubItem(index)}
                      className="flex items-center gap-2 rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 focus:outline-none"
                    >
                      + Altétel hozzáadása
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {itemsInActiveTab.length === 0 && rooms.length > 0 && (
        <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            Nincs tétel ebben a helyiségben.
          </p>
          <div className="flex flex-wrap gap-2">
            {items.some((i) => !i.roomId) && (
              <button
                type="button"
                onClick={() => setActiveTabId(null)}
                className="rounded bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200"
              >
                Meglévő tételek megtekintése (Egyéb)
              </button>
            )}
            <span className="text-sm text-gray-500">
              vagy kattintson a „Hozzáadás” gombra az új tételhez.
            </span>
          </div>
        </div>
      )}
      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          Kattintson a „Hozzáadás” gombra az első tétel hozzáadásához.
        </p>
      )}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={addItem}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Hozzáadás
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-1 border-t border-gray-200 pt-4">
        {rooms.length > 0 && getRoomsInOrder(rooms).map((room, orderedIdx) => {
          const idx = rooms.findIndex((r) => r.id === room.id);
          return (
          <div key={room.id} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); moveRoom(orderedIdx, -1); }}
              disabled={orderedIdx === 0}
              className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Balra"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); moveRoom(orderedIdx, 1); }}
              disabled={orderedIdx === rooms.length - 1}
              className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Jobbra"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabId(room.id)}
              className={`rounded-t px-3 py-1.5 text-sm font-medium focus:outline-none ${
                activeTabId === room.id
                  ? "border border-b-0 border-gray-300 bg-white text-blue-600"
                  : "border border-transparent text-gray-600 hover:bg-gray-100"
              }`}
            >
              <input
                type="text"
                value={room.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateRoom(idx, e.target.value)}
                placeholder="Pl. Nappali"
                className="min-w-[4rem] max-w-28 border-0 bg-transparent p-0 text-inherit placeholder:text-gray-400 focus:ring-0"
              />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeRoom(idx); }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-red-600"
              title="Helyiség törlése"
            >
              ×
            </button>
          </div>
          );
        })}
        {rooms.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTabId(null)}
            className={`rounded-t px-3 py-1.5 text-sm font-medium focus:outline-none ${
              activeTabId === null
                ? "border border-b-0 border-gray-300 bg-white text-blue-600"
                : "border border-transparent text-gray-600 hover:bg-gray-100"
            }`}
          >
            Egyéb
          </button>
        )}
        <button
          type="button"
          onClick={addRoom}
          className="rounded border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          + Helyiség hozzáadása
        </button>
      </div>
    </div>
  );
}
