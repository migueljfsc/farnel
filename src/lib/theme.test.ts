import { describe, expect, it } from "vitest";
import { isThemeChoice, nextTheme } from "./theme";

describe("theme", () => {
  it("cycles system, light, dark", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("accepts only known choices", () => {
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("sepia")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});
