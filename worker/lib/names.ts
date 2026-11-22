/** The key two ingredient names share when they differ only in case, accents or spacing. */
export const nameKey = (name: string): string =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
