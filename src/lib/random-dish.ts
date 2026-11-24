/**
 * A random dish to swap in: never the one being replaced, not the last suggestion again while
 * there is another, and one not eaten recently while there is one.
 */
export function pickRandom<T extends { id: number; tooSoon: boolean }>(
  options: T[],
  { current, previous }: { current: number; previous?: number },
  random: () => number = Math.random,
): T | undefined {
  const others = options.filter((o) => o.id !== current);
  const fresh = others.filter((o) => o.id !== previous);
  const pool = [fresh.filter((o) => !o.tooSoon), fresh, others].find((p) => p.length > 0) ?? [];
  return pool[Math.floor(random() * pool.length)];
}
