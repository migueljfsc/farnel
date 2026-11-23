import { describe, expect, it } from "vitest";
import { LOCALES, type Dictionary, plural, translate } from "./core";
import { en } from "./en";
import { detectLocale } from "./locale";
import { pt } from "./pt";

const DICTIONARIES: Record<string, Dictionary> = { en, pt };
const keys = Object.keys(en) as (keyof typeof en)[];
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the dictionaries", () => {
  it("name the same placeholders in every locale", () => {
    const wrong = keys.flatMap((key) => LOCALES.filter((l) => placeholders(DICTIONARIES[l][key]).join() !== placeholders(en[key]).join()).map((l) => `${l}:${key}`));
    expect(wrong).toEqual([]);
  });

  it("say something for every key", () => {
    for (const key of keys) for (const locale of LOCALES) expect(DICTIONARIES[locale][key].trim()).not.toBe("");
  });

  it("keep both halves of every plural", () => {
    for (const key of keys) {
      const partner = key.endsWith(".one") ? key.replace(/\.one$/, ".other") : key.endsWith(".other") ? key.replace(/\.other$/, ".one") : null;
      if (partner) expect(keys).toContain(partner);
    }
  });

  it("are actually translated, not copied", () => {
    // Names, units and words both languages share; anything new here is a forgotten string.
    expect(keys.filter((k) => en[k] === pt[k]).sort()).toEqual(["unit.g", "unit.ml", "unit.un"]);
  });
});

describe("translate", () => {
  it("fills placeholders and picks plural forms", () => {
    expect(translate(pt, "week.title", { day: "seg 23/11" })).toBe("Semana de seg 23/11");
    expect(plural(en, "dish.portions", 1)).toBe("1 portion");
    expect(plural(pt, "dish.portions", 3)).toBe("3 doses");
  });
});

describe("detectLocale", () => {
  it("speaks Portuguese to any Portuguese browser and English otherwise", () => {
    expect(detectLocale(["pt-PT"])).toBe("pt");
    expect(detectLocale(["pt-BR", "en"])).toBe("pt");
    expect(detectLocale(["fr-FR", "en-GB"])).toBe("en");
    expect(detectLocale(["de"])).toBe("en");
  });
});
