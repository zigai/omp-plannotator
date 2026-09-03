import type { AutocompleteProvider } from "@oh-my-pi/pi-tui";
import { describe, expect, it } from "vitest";
import { createPlannotatorGhostTextProvider } from "../../../src/command/autocomplete.ts";
import { PLANNOTATOR_GHOST_HINT } from "../../../src/command/constants.ts";

describe("createPlannotatorGhostTextProvider", () => {
    it("attaches ghost text hint to anno and plannotator completion suggestions", async () => {
        const fakeBaseProvider: AutocompleteProvider = {
            getSuggestions: async () => ({
                prefix: "/an",
                items: [
                    { value: "anno", label: "anno" },
                    { value: "plannotator", label: "plannotator" },
                    { value: "other", label: "other" },
                ],
            }),
            applyCompletion: (lines, cursorLine, cursorCol) => ({ lines, cursorLine, cursorCol }),
            getInlineHint: () => null,
        };

        const provider = createPlannotatorGhostTextProvider(fakeBaseProvider);
        const result = await provider.getSuggestions(["/an"], 0, 3);

        expect(result?.items).toEqual([
            { value: "anno", label: "anno", hint: `  ${PLANNOTATOR_GHOST_HINT}` },
            { value: "plannotator", label: "plannotator", hint: `  ${PLANNOTATOR_GHOST_HINT}` },
            { value: "other", label: "other" },
        ]);
    });

    it("returns null when base provider returns null", async () => {
        const fakeBaseProvider: AutocompleteProvider = {
            getSuggestions: async () => null,
            applyCompletion: (lines, cursorLine, cursorCol) => ({ lines, cursorLine, cursorCol }),
            getInlineHint: () => null,
        };

        const provider = createPlannotatorGhostTextProvider(fakeBaseProvider);
        const result = await provider.getSuggestions(["/xyz"], 0, 4);

        expect(result).toBeNull();
    });

    it("applies completion positioning the cursor before the space so block cursor does not cover 'd'", () => {
        const fakeBaseProvider: AutocompleteProvider = {
            getSuggestions: async () => null,
            applyCompletion: (lines, cursorLine, cursorCol) => ({ lines, cursorLine, cursorCol }),
            getInlineHint: () => null,
        };

        const provider = createPlannotatorGhostTextProvider(fakeBaseProvider);
        const applied = provider.applyCompletion(
            ["/an"],
            0,
            3,
            { value: "anno", label: "anno" },
            "/an",
        );

        expect(applied).toEqual({
            lines: ["/anno"],
            cursorLine: 0,
            cursorCol: 5,
        });
    });

    it("delegates applyCompletion to base for non-plannotator items", () => {
        const fakeBaseProvider: AutocompleteProvider = {
            getSuggestions: async () => null,
            applyCompletion: (_lines, _cursorLine, _cursorCol, item) => ({
                lines: [`/${item.value}`],
                cursorLine: 0,
                cursorCol: item.value.length + 1,
            }),
            getInlineHint: () => null,
        };

        const provider = createPlannotatorGhostTextProvider(fakeBaseProvider);
        const applied = provider.applyCompletion(
            ["/ot"],
            0,
            3,
            { value: "other", label: "other" },
            "/ot",
        );

        expect(applied).toEqual({
            lines: ["/other"],
            cursorLine: 0,
            cursorCol: 6,
        });
    });

    it("provides inline ghost text hints with leading space so block cursor does not cover 'd'", () => {
        const fakeBaseProvider: AutocompleteProvider = {
            getSuggestions: async () => null,
            applyCompletion: (lines, cursorLine, cursorCol) => ({ lines, cursorLine, cursorCol }),
            getInlineHint: () => "base-hint",
        };

        const provider = createPlannotatorGhostTextProvider(fakeBaseProvider);
        expect(provider.getInlineHint?.(["/anno"], 0, 5)).toBe(`  ${PLANNOTATOR_GHOST_HINT}`);
        expect(provider.getInlineHint?.(["/anno "], 0, 6)).toBe(`  ${PLANNOTATOR_GHOST_HINT}`);
        expect(provider.getInlineHint?.(["/plannotator"], 0, 12)).toBe(
            `  ${PLANNOTATOR_GHOST_HINT}`,
        );
        expect(provider.getInlineHint?.(["/plannotator "], 0, 13)).toBe(
            `  ${PLANNOTATOR_GHOST_HINT}`,
        );
        expect(provider.getInlineHint?.(["/other"], 0, 6)).toBe("base-hint");
    });

    it("decorates plannotator suggestions while leaving other provider suggestions intact", async () => {
        const baseProvider: AutocompleteProvider = {
            async getSuggestions() {
                return {
                    items: [
                        { value: "help", label: "help", hint: "show help" },
                        { value: "anno", label: "anno" },
                        { value: "plannotator", label: "plannotator" },
                    ],
                    prefix: "/",
                };
            },
            applyCompletion(lines, cursorLine, cursorCol) {
                return { lines, cursorLine, cursorCol };
            },
            getInlineHint() {
                return "base-hint";
            },
        };

        const provider = createPlannotatorGhostTextProvider(baseProvider);
        const suggestions = await provider.getSuggestions(["/"], 0, 1);

        expect(suggestions?.items).toEqual([
            { value: "help", label: "help", hint: "show help" },
            { value: "anno", label: "anno", hint: `  ${PLANNOTATOR_GHOST_HINT}` },
            { value: "plannotator", label: "plannotator", hint: `  ${PLANNOTATOR_GHOST_HINT}` },
        ]);
        expect(provider.getInlineHint?.(["/anno"], 0, 5)).toBe(`  ${PLANNOTATOR_GHOST_HINT}`);
        expect(provider.getInlineHint?.(["/help"], 0, 5)).toBe("base-hint");
    });
});
