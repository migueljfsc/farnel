import { describe, expect, it } from "vitest";
import { addMonths, monthWeeks } from "./calendar";

describe("calendar", () => {
  it("lists the Monday of every week that touches the month", () => {
    expect(monthWeeks("2026-11-23")).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(monthWeeks("2027-02-10")).toEqual(["2027-02-01", "2027-02-08", "2027-02-15", "2027-02-22"]);
  });

  it("moves by months from the first day", () => {
    expect(addMonths("2026-11-23", 1)).toBe("2026-12-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });
});
