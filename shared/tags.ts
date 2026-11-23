/**
 * Every dish carries one protein and one base, so plans can vary both across the week. Other tags
 * are free. Tags are stored lower-case, in Portuguese, as people write them.
 */
export const PROTEIN_TAGS = ["carne", "peixe", "marisco", "ovos", "vegetariano"] as const;
export const BASE_TAGS = ["arroz", "massa", "batata", "leguminosas", "pão", "sopa"] as const;

export type FixedTag = (typeof PROTEIN_TAGS)[number] | (typeof BASE_TAGS)[number];

const has = (tags: string[], group: readonly string[]) => tags.some((t) => group.includes(t.trim().toLowerCase()));

/** Whether the tags name at least one protein and one base. */
export const hasProteinAndBase = (tags: string[]): boolean => has(tags, PROTEIN_TAGS) && has(tags, BASE_TAGS);
