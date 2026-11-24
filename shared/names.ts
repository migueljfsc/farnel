/** The key two ingredient names share when they differ only in case, accents or spacing. */
export const nameKey = (name: string): string =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");

/** Whether `ingredient` holds `name` as whole words: "salada de polvo" holds "polvo", "polvo" does not hold "ovo". */
export const holdsName = (ingredient: string, name: string): boolean => ` ${nameKey(ingredient)} `.includes(` ${nameKey(name)} `);
