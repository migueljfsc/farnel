import { describe, expect, it } from "vitest";
import type { CookingView } from "../../shared/types";
import { freeMealsAfter, segments } from "./board";

const cooking = (id: number, meals: [string, "lunch" | "dinner"][], cookDate = meals[0][0]): CookingView => ({
  id,
  dishId: id,
  dish: `D${id}`,
  cookDate,
  portions: 4,
  costCents: 0,
  status: "planned",
  replacedBy: null,
  meals: meals.map(([date, slot]) => ({ date, slot })),
  feedback: [],
});

describe("board", () => {
  const week = "2026-11-23";

  it("lists the free meals after one, in order, up to the end of the week", () => {
    const taken = [cooking(1, [["2026-11-25", "lunch"]])];
    expect(freeMealsAfter(taken, week, { date: "2026-11-24", slot: "dinner" }).slice(0, 3)).toEqual([
      { date: "2026-11-25", slot: "dinner" },
      { date: "2026-11-26", slot: "lunch" },
      { date: "2026-11-26", slot: "dinner" },
    ]);
    expect(freeMealsAfter([], week, { date: "2026-11-29", slot: "dinner" })).toEqual([]);
  });

  it("joins consecutive days of one cooking into one segment per slot", () => {
    const c = cooking(1, [
      ["2026-11-23", "lunch"],
      ["2026-11-24", "lunch"],
    ]);
    expect(segments([c], week, "lunch")).toEqual([{ cooking: 0, start: 1, end: 3, first: true }]);
  });

  it("splits a cooking whose meals skip a day, marking only the first part", () => {
    const c = cooking(1, [
      ["2026-11-23", "lunch"],
      ["2026-11-25", "lunch"],
    ]);
    expect(segments([c], week, "lunch")).toEqual([
      { cooking: 0, start: 1, end: 2, first: true },
      { cooking: 0, start: 3, end: 4, first: false },
    ]);
  });

  it("keeps each slot to its own meals", () => {
    const c = cooking(1, [
      ["2026-11-23", "lunch"],
      ["2026-11-23", "dinner"],
    ]);
    expect(segments([c], week, "dinner")).toEqual([{ cooking: 0, start: 1, end: 2, first: true }]);
    expect(segments([cooking(2, [["2026-11-30", "lunch"]])], week, "lunch")).toEqual([]);
  });
});
