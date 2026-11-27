import { AISLES, type Aisle } from "../../shared/aisles";
import type { Store } from "../../shared/stores";
import type { ShoppingItem, StoreTotal, Unit } from "../../shared/types";

export interface AisleGroup {
  aisle: Aisle;
  items: ShoppingItem[];
}

/** Items grouped by aisle, in the order a shop is walked; names sorted within each aisle. */
export function byAisle(items: ShoppingItem[]): AisleGroup[] {
  return AISLES.map((aisle) => ({
    aisle,
    items: items.filter((i) => i.aisle === aisle).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/** The list as plain text, to send to a phone or paste into a note. */
export function shoppingText(
  heading: string,
  groups: AisleGroup[],
  format: { aisle: (aisle: Aisle) => string; quantity: (quantity: number, unit: Unit) => string },
): string {
  const blocks = groups.map((g) => [format.aisle(g.aisle), ...g.items.map((i) => `- ${i.name}, ${format.quantity(i.quantity, i.unit)}`)].join("\n"));
  return [heading, ...blocks].join("\n\n");
}

/** The store where something costs less, when both have a price and they differ. */
export function cheaperStore(costs: Record<Store, number | null>): Store | null {
  const { continente, pingo_doce } = costs;
  if (continente === null || pingo_doce === null || continente === pingo_doce) return null;
  return continente < pingo_doce ? "continente" : "pingo_doce";
}

/** The store with the lower total, only when every store has a price for every item. */
export function cheaperTotal(totals: StoreTotal[]): Store | null {
  if (totals.some((t) => t.missing > 0)) return null;
  const [first, second] = [...totals].sort((a, b) => a.totalCents - b.totalCents);
  return first && second && first.totalCents < second.totalCents ? first.store : null;
}
