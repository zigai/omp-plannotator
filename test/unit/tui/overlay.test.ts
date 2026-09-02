import { describe, expect, it } from "vitest";
import { ANNOTATE_PLAN_OPTION_LABEL, HOST_OPTIONS } from "../../../src/tui/layout-analyzer.ts";
import { createDecoratedOverlay, renderedPlainLines } from "../../harness/tui-overlay.ts";

describe("PlannotatorPlanReviewOverlay", () => {
    it("adds a sixth action without increasing the fullscreen overlay height", () => {
        const { original, overlay } = createDecoratedOverlay();
        const originalLines = renderedPlainLines(original);
        const decoratedLines = renderedPlainLines(overlay);
        const saveRow = decoratedLines.findIndex((line) => line.includes("Save and quit"));

        expect(decoratedLines).toHaveLength(originalLines.length);
        expect(
            decoratedLines.filter((line) => line.includes(ANNOTATE_PLAN_OPTION_LABEL)),
        ).toHaveLength(1);
        expect(decoratedLines[saveRow - 1]).toContain(ANNOTATE_PLAN_OPTION_LABEL);
        expect(decoratedLines.some((line) => line.includes("body three"))).toBe(false);
        expect(decoratedLines.at(-1)).toContain("╰");
    });

    it("moves from the host's penultimate action into Plannotator and back", () => {
        const { original, overlay, requestRender } = createDecoratedOverlay(
            HOST_OPTIONS.length - 2,
        );
        overlay.render(80);

        overlay.handleInput("\x1b[B");
        const selectedLines = renderedPlainLines(overlay);
        const selectedRow = selectedLines.find((line) => line.includes(ANNOTATE_PLAN_OPTION_LABEL));

        expect(selectedRow).toContain("");
        expect(selectedLines.filter((line) => line.includes(""))).toHaveLength(1);
        expect(original.selectedIndex).toBe(HOST_OPTIONS.length - 2);
        expect(requestRender).toHaveBeenCalled();

        overlay.handleInput("\x1b[A");
        const returnedLines = renderedPlainLines(overlay);
        expect(returnedLines.find((line) => line.includes("Refine plan"))).toContain("");
    });

    it("moves down from Plannotator to the host's last action", () => {
        const { original, overlay } = createDecoratedOverlay(HOST_OPTIONS.length - 2);
        overlay.render(80);
        overlay.handleInput("\x1b[B");
        overlay.handleInput("\x1b[B");

        const lines = renderedPlainLines(overlay);
        expect(original.selectedIndex).toBe(HOST_OPTIONS.length - 1);
        expect(lines.find((line) => line.includes("Save and quit"))).toContain("");
        expect(lines.find((line) => line.includes(ANNOTATE_PLAN_OPTION_LABEL))).not.toContain("");
    });

    it("cancels the host overlay before opening plan annotation", async () => {
        const { original, overlay, opened } = createDecoratedOverlay(HOST_OPTIONS.length - 2);
        overlay.render(80);
        overlay.handleInput("\x1b[B");
        overlay.handleInput("\r");
        await Promise.resolve();

        expect(original.inputs.at(-1)).toBe("\x1b");
        expect(opened.count).toBe(1);
    });

    it("handles a direct mouse click and remaps host rows after removing one body row", async () => {
        const { original, overlay, opened } = createDecoratedOverlay();
        const lines = renderedPlainLines(overlay);
        const insertedRow = lines.findIndex((line) => line.includes(ANNOTATE_PLAN_OPTION_LABEL));
        const firstHostRow = lines.findIndex((line) => line.includes("Approve and execute"));

        overlay.handleInput(`\x1b[<0;3;${insertedRow + 1}M`);
        await Promise.resolve();
        expect(opened.count).toBe(1);

        const second = createDecoratedOverlay();
        renderedPlainLines(second.overlay);
        second.overlay.handleInput(`\x1b[<0;3;${firstHostRow + 1}M`);
        expect(second.original.inputs.at(-1)).toBe(`\x1b[<0;3;${firstHostRow + 2}M`);
        expect(original.inputs.at(-1)).toBe("\x1b");
    });
});
