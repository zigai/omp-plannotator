import { describe, expect, it } from "vitest";
import { extractOmpEditTargets } from "../../../src/adapter/patch-targets.ts";

describe("extractOmpEditTargets", () => {
    const cwd = "/workspace";

    it("extracts direct single path", () => {
        const targets = extractOmpEditTargets({ path: "plans/draft.md" }, cwd);
        expect(targets).toEqual(["plans/draft.md"]);
    });

    it("extracts multiple direct paths array", () => {
        const targets = extractOmpEditTargets({ paths: ["plans/draft.md", "plans/notes.md"] }, cwd);
        expect(targets).toEqual(["plans/draft.md", "plans/notes.md"]);
    });

    it("extracts single section from hashline patch", () => {
        const hashlineInput = "[plans/draft.md#1A2B]\nPUT 1:\n+# Draft";
        const targets = extractOmpEditTargets({ input: hashlineInput }, cwd);
        expect(targets).toEqual(["plans/draft.md"]);
    });

    it("extracts multiple sections from hashline patch in authored order", () => {
        const hashlineInput =
            "[plans/step1.md#1A2B]\nPUT 1:\n+# Step 1\n[plans/step2.md#3C4D]\nPUT 1:\n+# Step 2";
        const targets = extractOmpEditTargets({ input: hashlineInput }, cwd);
        expect(targets).toEqual(["plans/step1.md", "plans/step2.md"]);
    });

    it("extracts move destination from hashline MV op", () => {
        const hashlineInput = "[plans/old-plan.md#1A2B]\nPUT 1:\n+# Renamed\nMV plans/new-plan.md";
        const targets = extractOmpEditTargets({ input: hashlineInput }, cwd);
        expect(targets).toEqual(["plans/old-plan.md", "plans/new-plan.md"]);
    });

    it("ignores legacy apply-patch format after clean cutover to hashline", () => {
        const applyPatchInput = [
            "*** Begin Patch",
            "*** Update File: plans/source.md",
            "*** Move to: plans/dest.md",
            "@@ -1,1 +1,1 @@",
            "-old",
            "+new",
            "*** End Patch",
        ].join("\n");
        const targets = extractOmpEditTargets({ input: applyPatchInput }, cwd);
        expect(targets).toEqual([]);
    });

    it("deduplicates paths while preserving first authored order", () => {
        const hashlineInput =
            "[plans/repeat.md#1A2B]\nPUT 1:\n+# First\n[plans/repeat.md#1A2B]\nPUT 2:\n+# Second";
        const targets = extractOmpEditTargets(
            { path: "plans/repeat.md", input: hashlineInput },
            cwd,
        );
        expect(targets).toEqual(["plans/repeat.md"]);
    });

    it("returns empty array for unrecognized/malformed input", () => {
        const targets = extractOmpEditTargets({ input: "invalid non-patch payload" }, cwd);
        expect(targets).toEqual([]);
    });
});
