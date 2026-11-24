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

  it("runs a tool and reports invalid arguments as a tool error", async () => {
    const ok = await (await rpc("localhost", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_context", arguments: {} } })).text();
    expect(ok).toContain("weekly budget");
    const bad = await (await rpc("localhost", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_dish", arguments: { id: "x" } } })).text();
    expect(bad).toContain('"isError":true');
  });

  it("names its icon in the server information", async () => {
    const text = await (await rpc("localhost", INITIALIZE)).text();
    expect(text).toContain("http://localhost/icons/icon-192.png");
  });

  it("asks for low-carb dishes with the household's minimum raw protein per portion", async () => {
    const text = await (await rpc("localhost", INITIALIZE)).text();
    expect(text).toContain("low-carb");
    expect(text).toContain("minProteinGrams");
  });

  it("tells Claude to keep away from ingredients someone never eats", async () => {
    expect(await (await rpc("localhost", INITIALIZE)).text()).toContain("never_eaten");
  });

  it("refuses a caller without an Access token", async () => {
    expect((await rpc("farnel.example.com", INITIALIZE)).status).toBe(401);
  });
});
