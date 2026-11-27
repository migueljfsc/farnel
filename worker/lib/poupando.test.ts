import { describe, expect, it } from "vitest";
import { byRelevance, searchStore, type Fetcher } from "./poupando";

const item = (over: Record<string, unknown>) => ({
  id: "5601312877158-continente",
  nome: "Salsa Fresca Continente",
  preco: 0.99,
  marca: "Continente",
  supermercado: "Continente",
  link: "https://www.continente.pt/produto/salsa-fresca-continente-5601312877158.html",
  ean: "5601312877158",
  unidade_preco: "embalagem",
  descricao_embalagem: "emb. 50 gr",
  ultima_atualizacao: "2026-11-23T01:52:17.627420+00:00",
  ...over,
});

const GROUPS = [
  [
    item({}),
    item({ id: "skupingo doce1-pingo doce", nome: "Salsa Fresca", preco: 1.09, supermercado: "Pingo Doce", ean: null, descricao_embalagem: null }),
  ],
  [item({ id: "kg-continente", nome: "Cebola Continente", preco: 1.69, unidade_preco: "kg", descricao_embalagem: null, ean: null })],
  [{ id: "broken", supermercado: "Continente" }],
];

function fake(body: unknown, status = 200): { fetcher: Fetcher; urls: URL[] } {
  const urls: URL[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    urls.push(new URL(String(input)));
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as Fetcher;
  return { fetcher, urls };
}

describe("searchStore", () => {
  it("lists the store's products from every group, priced in cents with their pack", async () => {
    const { fetcher } = fake(GROUPS);
    expect(await searchStore(fetcher, "salsa", "continente")).toEqual([
      {
        store: "continente",
        sourceId: "5601312877158-continente",
        name: "Salsa Fresca Continente",
        url: "https://www.continente.pt/produto/salsa-fresca-continente-5601312877158.html",
        ean: "5601312877158",
        packText: "emb. 50 gr",
        priceUnit: "embalagem",
        priceCents: 99,
        checkedAt: "2026-11-23T01:52:17.627420+00:00",
        pack: { quantity: 50, unit: "g" },
      },
      expect.objectContaining({ sourceId: "kg-continente", priceCents: 169, pack: { quantity: 1000, unit: "g" } }),
    ]);
  });

  it("asks for one store by its source name and sends nothing else", async () => {
    const { fetcher, urls } = fake([]);
    await searchStore(fetcher, "salsa fresca", "pingo_doce", 10);
    expect(urls).toHaveLength(1);
    expect(urls[0].origin + urls[0].pathname).toBe("https://poupando.pt/api/grupos");
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({ pesquisa: "salsa fresca", supermercado: "Pingo Doce", limite: "10" });
  });

  it("is unavailable on a refused request, a page that is not JSON, or a network error", async () => {
    expect(await searchStore(fake({ error: "x" }, 403).fetcher, "salsa", "continente")).toBe("unavailable");
    expect(await searchStore(fake("<html>").fetcher, "salsa", "continente")).toBe("unavailable");
    expect(await searchStore(fake({ not: "a list" }).fetcher, "salsa", "continente")).toBe("unavailable");
    const failing = (async () => {
      throw new Error("down");
    }) as unknown as Fetcher;
    expect(await searchStore(failing, "salsa", "continente")).toBe("unavailable");
  });
});

describe("byRelevance", () => {
  it("ranks names starting with the search as a word, then as a prefix, then holding it as a word, shorter first", () => {
    const names = ["Comida Húmida para Gato Frango", "Nuggets Frango", "Frango Inteiro Continente", "Peito de Frango", "Frango", "Frangolins"];
    const products = names.map((name, i) => ({ name, sourceId: String(i) }));
    expect(byRelevance(products, "frango").map((p) => p.name)).toEqual([
      "Frango",
      "Frango Inteiro Continente",
      "Frangolins",
      "Nuggets Frango",
      "Peito de Frango",
      "Comida Húmida para Gato Frango",
    ]);
  });
});
