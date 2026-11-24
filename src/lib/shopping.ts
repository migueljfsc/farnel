import { AISLES, type Aisle } from "../../shared/aisles";
import type { ShoppingItem, Unit } from "../../shared/types";

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

/** What is still to buy as "• Name" lines in aisle order, for appending to a shared note. */
export const notesText = (groups: AisleGroup[], bought: Set<number>): string =>
  groups
    .flatMap((g) => g.items)
    .filter((i) => !bought.has(i.ingredientId))
    .map((i) => `• ${i.name}`)
    .join("\n");

/** The Apple Shortcut that appends the list to the household's shared note; the same name on every phone. */
export const NOTES_SHORTCUT = "Farnel compras";

/** Opens the Shortcuts app and runs the named shortcut with `text` as its input. */
export const shortcutUrl = (name: string, text: string): string =>
  `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(text)}`;
