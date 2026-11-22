import { describe, expect, it } from "vitest";
import { date } from "./schemas";

describe("date schema", () => {
  it("accepts only real calendar dates", () => {
    expect(date.safeParse("2026-02-28").success).toBe(true);
    expect(date.safeParse("2028-02-29").success).toBe(true);
    expect(date.safeParse("2026-11-31").success).toBe(false);
    expect(date.safeParse("2026-13-01").success).toBe(false);
    expect(date.safeParse("2026-02-29").success).toBe(false);
  });
});
