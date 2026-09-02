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

    it("preserves prototype methods and bound this when wrapping a class-based AutocompleteProvider", async () => {
        class TestClassBasedProvider implements AutocompleteProvider {
            readonly customProperty = "custom-value";
            readonly #prefix = "sync:";

            async getSuggestions(): Promise<null> {
                return null;
            }

            applyCompletion(lines: string[], cursorLine: number, cursorCol: number) {
                return { lines, cursorLine, cursorCol };
            }

            trySyncSlashCompletion(text: string) {
                return { items: [{ value: `${this.#prefix}${text}`, label: text }], prefix: "/" };
            }

            shouldTriggerFileCompletion() {
                return true;
            }
        }

        const baseProvider = new TestClassBasedProvider();
        const provider = createPlannotatorGhostTextProvider(baseProvider);

        expect(provider.trySyncSlashCompletion?.("test")).toEqual({
            items: [{ value: "sync:test", label: "test" }],
            prefix: "/",
        });
        expect(Reflect.get(provider, "customProperty")).toBe("custom-value");
    });
});
