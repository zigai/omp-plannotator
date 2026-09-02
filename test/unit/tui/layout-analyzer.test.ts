import { describe, expect, it } from "vitest";
import {
    analyzePlanReviewLayout,
    hasSelectionCursor,
    isDivider,
    optionLabelRow,
    plainText,
    rebuildOptionRow,
} from "../../../src/tui/layout-analyzer.ts";

describe("layout-analyzer pure helpers", () => {
    it("strips VT control characters in plainText", () => {
        expect(plainText("\x1b[31mRed\x1b[0m Text")).toBe("Red Text");
    });

    it("locates option label rows correctly", () => {
        const lines = ["│ Header │", "│ Approve and execute │", "│ Save and quit │"];
        expect(optionLabelRow(lines, "Approve and execute")).toBe(1);
        expect(optionLabelRow(lines, "Save and quit")).toBe(2);
        expect(optionLabelRow(lines, "Nonexistent")).toBe(-1);
    });

    it("detects selection cursor in hasSelectionCursor", () => {
        expect(hasSelectionCursor("│  Approve and execute       │", "Approve and execute")).toBe(
            true,
        );
        expect(hasSelectionCursor("│   Approve and execute       │", "Approve and execute")).toBe(
            false,
        );
    });

    it("recognizes divider lines", () => {
        expect(isDivider("├─────────────────────────────┤")).toBe(true);
        expect(isDivider("──────")).toBe(true);
        expect(isDivider("│ Regular row │")).toBe(false);
    });
});

describe("analyzePlanReviewLayout", () => {
    it("analyzes standard host layout", () => {
        const lines = [
            "╭──────── Plan Review ────────╮",
            "│ body one                    │",
            "│ body two                    │",
            "├──────────────┴──────────────┤",
            "│ Plan mode - next step       │",
            "│  Approve and execute       │",
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
