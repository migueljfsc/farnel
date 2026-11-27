import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { StoreLinkInput, StoreProduct } from "../../../shared/types";
import { addIngredient, resetDb } from "../../test/fixtures";
import type { Fetcher } from "../poupando";
import { linkStatements, refreshStorePrices, storeLinks } from "./stores";

const db = env.DB;
const NOW = "2026-11-27T04:00:00Z";
const WEEK_AGO = "2026-11-20T04:00:00Z";

beforeEach(() => resetDb(db));

const link = (over: Partial<StoreLinkInput> = {}): StoreLinkInput => ({
  sourceId: "salsa-continente",
  name: "Salsa Fresca Continente",
  url: "https://www.continente.pt/produto/salsa.html",
  ean: null,
  packText: "emb. 50 gr",
  amount: 50,
  priceCents: 99,
  checkedAt: "2026-11-23T01:00:00Z",
  ...over,
});

describe("links", () => {
  it("links, shows the price per unit, and unlinks", async () => {
    const salsa = await addIngredient(db, "Salsa");
    await db.batch(linkStatements(db, salsa, { continente: link() }, NOW));
    expect((await storeLinks(db)).get(salsa)).toEqual([{ ...link(), store: "continente", unitPriceCents: 1980, missing: false, refreshedAt: NOW }]);

    await db.batch(linkStatements(db, salsa, { continente: link({ priceCents: 89 }) }, NOW));
    expect((await storeLinks(db)).get(salsa)?.[0].priceCents).toBe(89);

    await db.batch(linkStatements(db, salsa, { continente: null }, NOW));
    expect((await storeLinks(db)).get(salsa)).toBeUndefined();
  });

  it("go with their ingredient", async () => {
    const salsa = await addIngredient(db, "Salsa");
    await db.batch(linkStatements(db, salsa, { continente: link(), pingo_doce: link({ sourceId: "pd" }) }, NOW));
    await db.prepare("DELETE FROM ingredients WHERE id = ?1").bind(salsa).run();
    expect(await db.prepare("SELECT COUNT(*) AS n FROM store_products").first("n")).toBe(0);
  });
});

describe("refreshStorePrices", () => {
  const product = (over: Partial<StoreProduct>): StoreProduct => ({
    store: "continente",
    sourceId: "salsa-continente",
    name: "Salsa Fresca Continente",
    url: "https://www.continente.pt/produto/salsa.html",
    ean: null,
    packText: null,
    priceUnit: "embalagem",
    priceCents: 79,
    checkedAt: "2026-11-26T01:00:00Z",
    pack: null,
    ...over,
  });

  function searcher(answers: Record<string, StoreProduct[] | "unavailable">) {
    const asked: { query: string; store: string }[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("pesquisa") ?? "";
      asked.push({ query, store: url.searchParams.get("supermercado") ?? "" });
      const answer = answers[query] ?? [];
      if (answer === "unavailable") return new Response("no", { status: 503 });
      const raw = answer.map((p) => ({
        id: p.sourceId,
        nome: p.name,
        preco: p.priceCents / 100,
        supermercado: p.store === "continente" ? "Continente" : "Pingo Doce",
        link: p.url,
        ean: p.ean,
        unidade_preco: p.priceUnit,
        descricao_embalagem: p.packText,
        ultima_atualizacao: p.checkedAt,
      }));
      return Response.json([raw]);
    }) as Fetcher;
    return { fetcher, asked };
  }

  async function linked(name: string, over: Partial<StoreLinkInput>, refreshedAt: string, store: "continente" | "pingo_doce" = "continente") {
    const id = await addIngredient(db, name);
    await db.batch(linkStatements(db, id, { [store]: link(over) }, refreshedAt));
    return id;
  }

  const row = (id: number) =>
    db.prepare("SELECT price_cents AS priceCents, checked_at AS checkedAt, refreshed_at AS refreshedAt, missing FROM store_products WHERE ingredient_id = ?1").bind(id).first();

  it("updates a found product, marks a lost one, and leaves it alone when the source is down", async () => {
    const found = await linked("Salsa", { name: "Salsa Fresca Continente" }, WEEK_AGO);
    const lost = await linked("Coentros", { sourceId: "coentros", name: "Coentros Continente" }, WEEK_AGO);
    const down = await linked("Hortelã", { sourceId: "hortela", name: "Hortelã Continente" }, WEEK_AGO);
    const { fetcher } = searcher({
      "Salsa Fresca Continente": [product({})],
      "Coentros Continente": [product({ sourceId: "other" })],
      "Hortelã Continente": "unavailable",
    });

    expect(await refreshStorePrices(db, fetcher, NOW)).toEqual({ refreshed: 1, missing: 1, failed: 1 });
    expect(await row(found)).toEqual({ priceCents: 79, checkedAt: "2026-11-26T01:00:00Z", refreshedAt: NOW, missing: 0 });
    expect(await row(lost)).toEqual({ priceCents: 99, checkedAt: "2026-11-23T01:00:00Z", refreshedAt: NOW, missing: 1 });
    expect(await row(down)).toEqual({ priceCents: 99, checkedAt: "2026-11-23T01:00:00Z", refreshedAt: WEEK_AGO, missing: 0 });
  });

  it("searches by barcode when there is one, in the link's store", async () => {
    await linked("Atum", { sourceId: "atum-pd", name: "Atum", ean: "560123" }, WEEK_AGO, "pingo_doce");
    const { fetcher, asked } = searcher({ "560123": [product({ sourceId: "atum-pd", store: "pingo_doce" })] });
    expect(await refreshStorePrices(db, fetcher, NOW)).toEqual({ refreshed: 1, missing: 0, failed: 0 });
    expect(asked).toEqual([{ query: "560123", store: "Pingo Doce" }]);
  });

  it("skips links refreshed in the last 6 days and takes the oldest first, up to the limit", async () => {
    await linked("Recent", { name: "recent" }, "2026-11-22T04:00:00Z");
    await linked("Old", { name: "old" }, "2026-11-01T04:00:00Z");
    await linked("Older", { name: "older" }, "2026-10-01T04:00:00Z");
    const { fetcher, asked } = searcher({});
    await refreshStorePrices(db, fetcher, NOW, 1);
    expect(asked.map((a) => a.query)).toEqual(["older"]);
  });
});
