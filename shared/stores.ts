/** Supermarkets whose prices Farnel compares, and their names at the price source. */

export const STORES = ["continente", "pingo_doce"] as const;
export type Store = (typeof STORES)[number];

export const SOURCE_NAME: Record<Store, string> = { continente: "Continente", pingo_doce: "Pingo Doce" };
