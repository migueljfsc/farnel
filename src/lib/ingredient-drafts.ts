/** Unsaved edits to ingredients on the Ingredients page, saved together. */

import type { Aisle } from "../../shared/aisles";
import { parseMoney } from "../../shared/format";
import { STORES, type Store } from "../../shared/stores";
import type { DecidedStatus, IngredientView, RestrictionStatus, StoreLinkInput, StoreLinkView, Unit } from "../../shared/types";

/** What a person changed on one ingredient, as typed. `protein` is grams per unit; "" when not a protein. */
export interface Draft {
  aisle?: Aisle;
  unit?: Unit;
  price?: string;
  protein?: string;
  /** A new count of what is at home, before planned cookings; "" clears it. */
  stock?: string;
  statuses?: Record<number, DecidedStatus>;
  /** A new product per store; null unlinks it. */
  stores?: Partial<Record<Store, StoreLinkInput | null>>;
  /** Take Preço from this store's saved link instead of the typed price. */
  priceFromStore?: Store;
}

export interface IngredientPatch {
  aisle?: Aisle;
  unit?: Unit;
  priceCents?: number | null;
  proteinGrams?: number | null;
  stock?: number | null;
  statuses?: Record<number, DecidedStatus>;
  stores?: Partial<Record<Store, StoreLinkInput | null>>;
  priceFromStore?: Store;
}

export interface DraftView {
  aisle: Aisle;
  unit: Unit;
  price: string;
  protein: string;
  stock: string;
  statuses: Record<number, RestrictionStatus>;
  stores: Record<Store, StoreLinkInput | StoreLinkView | null>;
}

const priceText = (cents: number | null): string => (cents === null ? "" : (cents / 100).toFixed(2));

/** The values a row shows: the draft where there is one, the saved ingredient elsewhere. */
export function draftView(ingredient: IngredientView, draft: Draft | undefined): DraftView {
  return {
    aisle: draft?.aisle ?? ingredient.aisle,
    unit: draft?.unit ?? ingredient.unit,
    price: draft?.price ?? priceText(ingredient.priceCents),
    protein: draft?.protein ?? (ingredient.proteinGrams === null ? "" : String(ingredient.proteinGrams)),
    stock: draft?.stock ?? (ingredient.stockCount === null ? "" : String(ingredient.stockCount)),
    statuses: { ...ingredient.statuses, ...draft?.statuses },
    stores: Object.fromEntries(STORES.map((store) => [store, draft?.stores?.[store] !== undefined ? draft.stores[store] : savedLink(ingredient, store)])) as DraftView["stores"],
  };
}

const savedLink = (ingredient: IngredientView, store: Store): StoreLinkView | null => ingredient.stores.find((s) => s.store === store) ?? null;

const LINK_FIELDS = ["sourceId", "name", "url", "ean", "packText", "amount", "priceCents", "checkedAt"] as const;

const sameLink = (a: StoreLinkInput | null, b: StoreLinkInput | null): boolean => (a === null || b === null ? a === b : LINK_FIELDS.every((f) => a[f] === b[f]));

function parseProtein(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const grams = Number(text.trim().replace(",", "."));
  return Number.isFinite(grams) && grams > 0 ? grams : undefined;
}

/** The fields of `draft` that differ from the saved ingredient, and whether they can be saved. */
export function patchFor(ingredient: IngredientView, draft: Draft | undefined): { patch: IngredientPatch; valid: boolean } {
  const patch: IngredientPatch = {};
  let valid = true;
  if (!draft) return { patch, valid };
  if (draft.aisle !== undefined && draft.aisle !== ingredient.aisle) patch.aisle = draft.aisle;
  if (draft.unit !== undefined && draft.unit !== ingredient.unit) patch.unit = draft.unit;
  if (draft.priceFromStore !== undefined) patch.priceFromStore = draft.priceFromStore;
  else if (draft.price !== undefined) {
    const cents = draft.price.trim() === "" ? null : parseMoney(draft.price);
    if (draft.price.trim() !== "" && cents === null) valid = false;
    else if (cents !== ingredient.priceCents) patch.priceCents = cents;
  }
  if (draft.protein !== undefined) {
    const grams = parseProtein(draft.protein);
    if (grams === undefined) valid = false;
    else if (grams !== ingredient.proteinGrams) patch.proteinGrams = grams;
  }
  if (draft.stock !== undefined) {
    const text = draft.stock.trim().replace(",", ".");
    const count = text === "" ? null : Number(text);
    if (count !== null && !(Number.isFinite(count) && count >= 0)) valid = false;
    else if (count !== ingredient.stockCount) patch.stock = count;
  }
  if (draft.stores !== undefined) {
    const stores: Partial<Record<Store, StoreLinkInput | null>> = {};
    for (const store of STORES) {
      const link = draft.stores[store];
      if (link === undefined || sameLink(link, savedLink(ingredient, store))) continue;
      if (link && !(link.amount > 0)) valid = false;
      stores[store] = link;
    }
    if (Object.keys(stores).length > 0) patch.stores = stores;
  }
  if (draft.statuses !== undefined && Object.entries(draft.statuses).some(([id, status]) => ingredient.statuses[Number(id)] !== status)) {
    patch.statuses = draft.statuses;
  }
  return { patch, valid };
}
