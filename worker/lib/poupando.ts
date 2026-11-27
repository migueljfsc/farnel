/**
 * Store prices from Poupando.pt's product search, which groups items from several supermarkets.
 * Only the search phrase and the store name are sent.
 */

import { z } from "zod";
import { nameKey } from "../../shared/names";
import { packOf } from "../../shared/packs";
import { SOURCE_NAME, type Store } from "../../shared/stores";
import type { StoreProduct } from "../../shared/types";

export type Fetcher = typeof fetch;

const SEARCH = "https://poupando.pt/api/grupos";

const item = z.object({
  id: z.string().min(1).max(200),
  nome: z.string().min(1).max(300),
  preco: z.number().nonnegative().max(10_000),
  supermercado: z.string(),
  link: z.url().max(1000),
  ean: z.string().max(20).nullish(),
  unidade_preco: z.string().max(30).nullish(),
  descricao_embalagem: z.string().max(200).nullish(),
  ultima_atualizacao: z.string().min(10).max(40),
});

/** Products of `store` matching `query`, or "unavailable" when the source cannot be read. Items of an unexpected shape are dropped. */
export async function searchStore(fetcher: Fetcher, query: string, store: Store, limit = 10): Promise<StoreProduct[] | "unavailable"> {
  const url = new URL(SEARCH);
  url.search = new URLSearchParams({ pesquisa: query, supermercado: SOURCE_NAME[store], limite: String(limit) }).toString();
  let body: unknown;
  try {
    const response = await fetcher(url, { headers: { accept: "application/json", "user-agent": "farnel" }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return "unavailable";
    body = await response.json();
  } catch {
    return "unavailable";
  }
  if (!Array.isArray(body)) return "unavailable";
  const products: StoreProduct[] = [];
  for (const raw of body.flat()) {
    const parsed = item.safeParse(raw);
    if (!parsed.success || parsed.data.supermercado !== SOURCE_NAME[store]) continue;
    const p = parsed.data;
    products.push({
      store,
      sourceId: p.id,
      name: p.nome,
      url: p.link,
      ean: p.ean ?? null,
      packText: p.descricao_embalagem ?? null,
      priceUnit: p.unidade_preco ?? null,
      priceCents: Math.round(p.preco * 100),
      checkedAt: p.ultima_atualizacao,
      pack: packOf(p.unidade_preco ?? null, p.descricao_embalagem ?? null, p.nome),
    });
  }
  return products;
}

/**
 * Products ordered by how well their name matches `query` (case and accents ignored): starting with
 * it as a word, starting with it, holding it as a word, the rest; shorter names first within each.
 */
export function byRelevance<P extends { name: string }>(products: P[], query: string): P[] {
  const wanted = nameKey(query);
  const tier = (name: string) => {
    const key = nameKey(name);
    if (key === wanted || key.startsWith(`${wanted} `)) return 0;
    if (key.startsWith(wanted)) return 1;
    if (` ${key} `.includes(` ${wanted} `)) return 2;
    return 3;
  };
  return [...products].sort((a, b) => tier(a.name) - tier(b.name) || a.name.length - b.name.length);
}
