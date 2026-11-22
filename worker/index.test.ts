import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "./index";
import { SECURITY_HEADERS } from "./lib/headers";
import { addPerson, resetDb } from "./test/fixtures";

beforeEach(async () => {
  await resetDb(env.DB);
  await addPerson(env.DB, "a@example.com", "Ana");
});

describe("worker", () => {
  it("answers unknown API paths with a secured JSON 404", async () => {
    const response = await worker.fetch(new Request("http://localhost/api/nope"), env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(response.headers.get("content-security-policy")).toBe(SECURITY_HEADERS["content-security-policy"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers the API with 401 before anything else when no one is signed in", async () => {
    const response = await worker.fetch(new Request("https://farnel.example.com/api/nope"), env);
    expect(response.status).toBe(401);
  });
});
