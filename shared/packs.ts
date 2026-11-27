/** Pack sizes of store products, and how much of an ingredient one priced item gives. */

import type { Unit } from "./types";

export interface Pack {
  quantity: number;
  unit: Unit;
}

const PER: Record<string, Pack> = { kg: { quantity: 1000, unit: "g" }, l: { quantity: 1000, unit: "ml" }, un: { quantity: 1, unit: "un" } };

const SIZE = /(\d+(?:[.,]\d+)?)\s*(?:x\s*(\d+(?:[.,]\d+)?)\s*)?(kg|gr|g|cl|ml|l|un)\b/i;

const SCALE: Record<string, Pack> = {
  kg: { quantity: 1000, unit: "g" },
  gr: { quantity: 1, unit: "g" },
  g: { quantity: 1, unit: "g" },
  cl: { quantity: 10, unit: "ml" },
  ml: { quantity: 1, unit: "ml" },
  l: { quantity: 1000, unit: "ml" },
  un: { quantity: 1, unit: "un" },
};

const num = (text: string) => Number(text.replace(",", "."));

function parse(text: string | null): Pack | null {
  const match = text && SIZE.exec(text);
  if (!match) return null;
  const count = match[2] === undefined ? 1 : num(match[1]);
  const size = num(match[2] ?? match[1]);
  const scale = SCALE[match[3].toLowerCase()];
  return { quantity: Math.round(count * size * scale.quantity * 100) / 100, unit: scale.unit };
}

/** What one priced item holds: a kg, litre or unit when priced by it, else the size in the pack text or the name. */
export function packOf(priceUnit: string | null, packText: string | null, name: string): Pack | null {
  const per = priceUnit && PER[priceUnit.toLowerCase()];
  return per || parse(packText) || parse(name);
}

/** How much of an ingredient in `ingredientUnit` one priced item gives; weight becomes units with `gramsPerUnit`. */
export function amountFor(pack: Pack, ingredientUnit: Unit, gramsPerUnit?: number): number | null {
  if (pack.unit === ingredientUnit) return pack.quantity;
  if (ingredientUnit === "un" && pack.unit === "g" && gramsPerUnit && gramsPerUnit > 0) return Math.round((pack.quantity / gramsPerUnit) * 100) / 100;
  return null;
}
