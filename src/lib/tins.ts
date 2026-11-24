/** A cooking is drawn as a tin whose label colour says what protein the dish has. */

import { PROTEIN_TAGS } from "../../shared/tags";

export type TinTone = (typeof PROTEIN_TAGS)[number] | "none";

export const tinTone = (tags: string[]): TinTone => PROTEIN_TAGS.find((p) => tags.includes(p)) ?? "none";

/** Background and text classes for a tin of each tone; egg tins are mustard, so their text is ink. */
export const TIN_CLASS: Record<TinTone, string> = {
  carne: "bg-tin-carne text-white",
  peixe: "bg-tin-peixe text-white",
  marisco: "bg-tin-marisco text-white",
  ovos: "bg-tin-ovos text-[#17201e]",
  vegetariano: "bg-tin-vegetariano text-white",
  none: "bg-tin-none text-white",
};

/** The same colour as a thin strip, for rows that list dishes. */
export const TIN_STRIP: Record<TinTone, string> = {
  carne: "bg-tin-carne",
  peixe: "bg-tin-peixe",
  marisco: "bg-tin-marisco",
  ovos: "bg-tin-ovos",
  vegetariano: "bg-tin-vegetariano",
  none: "bg-tin-none",
};
