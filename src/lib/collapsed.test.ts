import { describe, expect, it } from "vitest";
import { toggledKey } from "./collapsed";

describe("toggledKey", () => {
  it("adds a key that is missing and removes one that is there", () => {
    expect(toggledKey(["fish"], "produce")).toEqual(["fish", "produce"]);
    expect(toggledKey(["fish", "produce"], "fish")).toEqual(["produce"]);
  });
});
