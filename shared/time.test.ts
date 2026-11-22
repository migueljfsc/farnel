import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isMonday, todayLisbon, weekStartOf } from "./time";

describe("time", () => {
  it("reads today in Lisbon, across the DST switch", () => {
    expect(todayLisbon(new Date("2026-03-29T23:30:00Z"))).toBe("2026-03-30");
    expect(todayLisbon(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-22");
  });

  it("finds the Monday of a week", () => {
    expect(weekStartOf("2026-11-22")).toBe("2026-11-16");
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23");
    expect(isMonday("2026-11-23")).toBe(true);
    expect(isMonday("2026-11-24")).toBe(false);
  });

  it("adds and counts days", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-10", "2026-11-24")).toBe(14);
  });
});
