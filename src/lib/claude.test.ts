import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { pt } from "../i18n/pt";
import { translator } from "../i18n/core";
import { claudeLinks, planPrompt } from "./claude";

const EN = { t: translator(en), locale: "en" as const };

describe("plan prompt", () => {
  it("names the week and asks Claude to save the plan with the tools", () => {
    const prompt = planPrompt({ weekStart: "2026-11-23", notes: "", eaters: null }, EN);
    expect(prompt).toContain("week starting Mon 23/11 (2026-11-23)");
    expect(prompt).toContain("save_plan");
    expect(prompt).not.toContain("Notes");
  });

  it("includes this week's notes when there are any", () => {
    expect(planPrompt({ weekStart: "2026-11-23", notes: "  we eat out Thursday ", eaters: null }, EN)).toContain("Notes for this week: we eat out Thursday");
  });

  it("says who is eating when it is not everyone", () => {
    expect(planPrompt({ weekStart: "2026-11-23", notes: "", eaters: null }, EN)).toContain("for everyone");
    expect(planPrompt({ weekStart: "2026-11-23", notes: "", eaters: ["Miguel"] }, EN)).toContain("only for Miguel");
    expect(planPrompt({ weekStart: "2026-11-23", notes: "", eaters: ["Ana", "Bea"] }, EN)).toContain("only for Ana and Bea");
  });
});

describe("plan prompt in Portuguese", () => {
  it("asks in Portuguese, so Claude answers in Portuguese", () => {
    const prompt = planPrompt({ weekStart: "2026-11-23", notes: "jantamos fora na quinta", eaters: ["Miguel"] }, { t: translator(pt), locale: "pt" });
    expect(prompt).toContain("semana de seg 23/11 (2026-11-23), só para Miguel");
    expect(prompt).toContain("Notas desta semana: jantamos fora na quinta");
    expect(prompt).toContain("save_plan");
  });
});

describe("claude links", () => {
  it("encodes the prompt for the app deep link and the web", () => {
    expect(claudeLinks("a b&c")).toEqual({
      app: "claude://claude.ai/new?q=a%20b%26c",
      web: "https://claude.ai/new?q=a%20b%26c",
    });
  });
});
