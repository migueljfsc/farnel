/** Supermarket aisles, in the order a shop is usually walked; the shopping list groups by them. */
export const AISLES = ["produce", "bakery", "butcher", "fish", "dairy", "pantry", "frozen", "misc"] as const;

export type Aisle = (typeof AISLES)[number];
