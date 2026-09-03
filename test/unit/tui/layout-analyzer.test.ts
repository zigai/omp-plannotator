import { describe, expect, it } from "vitest";
import { analyzePlanReviewLayout, rebuildOptionRow } from "../../../src/tui/layout-analyzer.ts";

describe("analyzePlanReviewLayout", () => {
    it("analyzes standard host layout with ANSI styling and active selection", () => {
        const lines = [
            "\x1b[1m╭──────── Plan Review ────────╮\x1b[0m",
            "│ body one                    │",
            "│ body two                    │",
            "├──────────────┴──────────────┤",
            "│ Plan mode - next step       │",
            "│ \x1b[32m Approve and execute\x1b[0m       │",
            "│   Compact context and exec  │",
            "│   Keep context and execute  │",
            "│   Refine plan               │",
            "│   Save and quit             │",
            "├─────────────────────────────┤",
            "│ ↑↓ select · ⏎ confirm       │",
            "╰─────────────────────────────╯",
        ];

        const layout = analyzePlanReviewLayout(lines);
        expect(layout).toBeDefined();
        expect(layout?.actionsFocused).toBe(true);
        expect(layout?.lastHostOptionLabel).toBe("Save and quit");
        expect(layout?.selectedHostOptionRow).toBe(5);
        expect(layout?.removeRow).toBe(2);
    });

    it("analyzes layout when Refine plan is the last available option", () => {
        const lines = [
            "╭──────── Plan Review ────────╮",
            "│ body one                    │",
            "├─────────────────────────────┤",
            "│ Plan mode - next step       │",
            "│   Approve and execute       │",
            "│  Refine plan               │",
            "├─────────────────────────────┤",
            "│ ↑↓ select · ⏎ confirm       │",
            "╰─────────────────────────────╯",
        ];

        const layout = analyzePlanReviewLayout(lines);
        expect(layout).toBeDefined();
        expect(layout?.lastHostOptionLabel).toBe("Refine plan");
        expect(layout?.lastHostOptionRow).toBe(5);
        expect(layout?.precedingHostOptionRow).toBe(4);
        expect(layout?.selectedHostOptionRow).toBe(5);
    });

    it("returns undefined when title or prompt is missing", () => {
        expect(analyzePlanReviewLayout(["random text"])).toBeUndefined();
    });
});

describe("rebuildOptionRow", () => {
    it("replaces label preserving borders and padding", () => {
        const template = "│   Save and quit             │";
        const result = rebuildOptionRow(template, "Save and quit", "Annotate with Plannotator");
        expect(result).toBe("│   Annotate with Plannotator │");
        expect(result.startsWith("│")).toBe(true);
        expect(result.endsWith("│")).toBe(true);
        expect(result.length).toBe(template.length);
    });
});
