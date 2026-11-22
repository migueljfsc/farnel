import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../index";

const rpc = (host: string, body: unknown) =>
  worker.fetch(
    new Request(`http://${host}/mcp`, {
      method: "POST",
      headers: { host, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    }),
    env,
    createExecutionContext(),
  );

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
};

describe("mcp endpoint", () => {
  it("initializes and lists the tools", async () => {
    expect((await rpc("localhost", INITIALIZE)).status).toBe(200);
    const list = await rpc("localhost", { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(list.status).toBe(200);
    const text = await list.text();
    for (const name of ["get_context", "save_plan", "add_dish"]) expect(text).toContain(name);
  });

  it("refuses a caller without an Access token", async () => {
    expect((await rpc("farnel.example.com", INITIALIZE)).status).toBe(401);
  });
});
