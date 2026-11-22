import { describe, expect, it } from "vitest";
import { claudeLinks, planPrompt } from "./claude";

describe("plan prompt", () => {
  it("names the week and asks Claude to save the plan with the tools", () => {
    const prompt = planPrompt({ weekStart: "2026-11-23", notes: "", eaters: null });
    expect(prompt).toContain("week starting Mon 23/11 (2026-11-23)");
    expect(prompt).toContain("save_plan");
    expect(prompt).not.toContain("Notes");
  });

  it("includes this week's notes when there are any", () => {
    expect(planPrompt({ weekStart: "2026-11-23", notes: "  we eat out Thursday ", eaters: null })).toContain("Notes for this week: we eat out Thursday");
  });

  it("says who is eating when it is not everyone", () => {
    expect(planPrompt({ weekStart: "2026-11-23", notes: "", eaters: null })).toContain("for everyone");
    expect(planPrompt({ weekStart: "2026-11-23", notes: "", eaters: ["Miguel"] })).toContain("only for Miguel");
    expect(planPrompt({ weekStart: "2026-11-23", notes: "", eaters: ["Ana", "Bea"] })).toContain("only for Ana and Bea");
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
