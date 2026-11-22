import { describe, expect, it } from "vitest";
import { nameKey } from "./names";

describe("nameKey", () => {
  it("ignores case, accents and spacing", () => {
    expect(nameKey("  Grão  de BICO ")).toBe("grao de bico");
    expect(nameKey("Grão")).toBe(nameKey("grao"));
  });
});
