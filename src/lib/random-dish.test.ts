import { describe, expect, it } from "vitest";
import { pickRandom } from "./random-dish";

const option = (id: number, tooSoon = false) => ({ id, tooSoon });

describe("pickRandom", () => {
  it("never suggests the dish being replaced or the last suggestion", () => {
    const options = [option(1), option(2), option(3)];
    for (const r of [0, 0.5, 0.99]) expect(pickRandom(options, { current: 1, previous: 2 }, () => r)?.id).toBe(3);
  });

  it("prefers dishes not eaten recently, falling back to them", () => {
    expect(pickRandom([option(1), option(2, true), option(3)], { current: 1 }, () => 0.99)?.id).toBe(3);
    expect(pickRandom([option(1), option(2, true)], { current: 1 }, () => 0)?.id).toBe(2);
  });

  it("repeats the last suggestion only when nothing else is left, and gives up when nothing is", () => {
    expect(pickRandom([option(1), option(2)], { current: 1, previous: 2 }, () => 0)?.id).toBe(2);
    expect(pickRandom([option(1)], { current: 1 })).toBeUndefined();
  });
});
