import { describe, expect, it } from "vitest";
import { holdsName, nameKey } from "./names";

describe("nameKey", () => {
  it("ignores case, accents and spacing", () => {
    expect(nameKey("  Grão  de BICO ")).toBe("grao de bico");
    expect(nameKey("Grão")).toBe(nameKey("grao"));
  });
});

describe("holdsName", () => {
  it("finds a name as a whole word, ignoring case and accents", () => {
    expect(holdsName("Salada de Pólvo", "polvo")).toBe(true);
    expect(holdsName("Leite de coco", "Leite de coco")).toBe(true);
    expect(holdsName("Polvo", "ovo")).toBe(false);
  });
});
