import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "./index";
import { SECURITY_HEADERS } from "./lib/headers";

describe("worker", () => {
  it("answers unknown API paths with a secured JSON 404", async () => {
    const response = await worker.fetch(new Request("http://localhost/api/nope"), env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(response.headers.get("content-security-policy")).toBe(SECURITY_HEADERS["content-security-policy"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
