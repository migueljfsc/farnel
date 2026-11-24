import { describe, expect, it } from "vitest";
import { tinTone } from "./tins";

describe("tinTone", () => {
  it("takes the first protein tag", () => {
    expect(tinTone(["arroz", "peixe"])).toBe("peixe");
    expect(tinTone(["vegetariano"])).toBe("vegetariano");
    expect(tinTone(["carne", "ovos"])).toBe("carne");
  });

  it("is none without a protein tag", () => {
    expect(tinTone(["sopa"])).toBe("none");
    expect(tinTone([])).toBe("none");
  });
});
