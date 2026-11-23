import { describe, expect, it } from "vitest";
import { href, parseRoute, type Route } from "./router";

describe("router", () => {
  it("parses every page", () => {
    expect(parseRoute("/", "")).toEqual({ page: "week" });
    expect(parseRoute("/week/2026-11-23", "")).toEqual({ page: "week", weekStart: "2026-11-23" });
    expect(parseRoute("/history", "")).toEqual({ page: "history" });
    expect(parseRoute("/dishes", "?filter=to-validate")).toEqual({ page: "dishes", filter: "to-validate" });
    expect(parseRoute("/dishes/12", "")).toEqual({ page: "dish", id: 12 });
    expect(parseRoute("/dishes/new", "")).toEqual({ page: "dish", id: "new" });
    expect(parseRoute("/ingredients", "?filter=to-decide")).toEqual({ page: "ingredients", filter: "to-decide" });
    expect(parseRoute("/settings", "")).toEqual({ page: "settings" });
    expect(parseRoute("/review", "")).toEqual({ page: "review" });
  });

  it("falls back to the week for unknown paths and filters", () => {
    expect(parseRoute("/nope", "")).toEqual({ page: "week" });
    expect(parseRoute("/dishes", "?filter=bogus")).toEqual({ page: "dishes" });
  });

  it("round-trips routes through href", () => {
    const routes: Route[] = [
      { page: "week" },
      { page: "week", weekStart: "2026-11-23" },
      { page: "history" },
      { page: "dishes" },
      { page: "dishes", filter: "to-validate" },
      { page: "dishes", filter: "archived" },
      { page: "dish", id: 12 },
      { page: "dish", id: "new" },
      { page: "ingredients" },
      { page: "ingredients", filter: "to-decide" },
      { page: "settings" },
      { page: "review" },
    ];
    for (const route of routes) {
      const url = new URL(href(route), "http://x");
      expect(parseRoute(url.pathname, url.search)).toEqual(route);
    }
  });
});
