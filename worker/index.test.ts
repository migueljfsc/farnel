import { env } from "cloudflare:workers";
import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { SECURITY_HEADERS } from "./lib/headers";
import { linkStatements } from "./lib/service/stores";
import { addIngredient, addPerson, resetDb } from "./test/fixtures";

beforeEach(async () => {
  await resetDb(env.DB);
  await addPerson(env.DB, "a@example.com", "Ana");
});

describe("worker", () => {
  it("answers unknown API paths with a secured JSON 404", async () => {
    const response = await worker.fetch(new Request("http://localhost/api/nope"), env, createExecutionContext());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(response.headers.get("content-security-policy")).toBe(SECURITY_HEADERS["content-security-policy"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers the API with 401 before anything else when no one is signed in", async () => {
    const response = await worker.fetch(new Request("https://farnel.example.com/api/nope"), env, createExecutionContext());
    expect(response.status).toBe(401);
  });
});

describe("daily job", () => {
  afterEach(() => vi.restoreAllMocks());

  it("refreshes store prices", async () => {
    const salsa = await addIngredient(env.DB, "Salsa");
    const link = { sourceId: "s", name: "Salsa Fresca", url: "https://www.continente.pt/p.html", ean: null, packText: null, amount: 50, priceCents: 99, checkedAt: "2026-01-01T00:00:00Z" };
    await env.DB.batch(linkStatements(env.DB, salsa, { continente: link }, "2026-01-01T00:00:00Z"));
    const item = { id: "s", nome: "Salsa Fresca", preco: 0.79, supermercado: "Continente", link: link.url, ean: null, unidade_preco: "embalagem", descricao_embalagem: null, ultima_atualizacao: "2026-11-26T00:00:00Z" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([[item]]));
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "0 4 * * *" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await env.DB.prepare("SELECT price_cents FROM store_products").first("price_cents")).toBe(79);
  });
});
