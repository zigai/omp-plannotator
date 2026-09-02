import { describe, expect, it } from "vitest";
import { shiftMouseRow } from "../../../src/tui/mouse-mapper.ts";
import type { RenderedLayout } from "../../../src/types/index.ts";

describe("shiftMouseRow", () => {
    const layout: RenderedLayout = {
        removeRow: 3,
        insertedOptionRow: 8,
    };

    it("shifts SGR row when displayed row is between removeRow and insertedOptionRow", () => {
        // displayed row 5 (0-indexed) => raw string has row 6 (1-indexed)
        // shifted row is 5 + 2 = 7
        const input = "\x1b[<0;10;6M";
        const shifted = shiftMouseRow(input, layout);
        expect(shifted).toBe("\x1b[<0;10;7M");
    });

    it("leaves SGR row unchanged when displayed row is below removeRow", () => {
        // displayed row 2 (< removeRow 3) => raw row 3
        const input = "\x1b[<0;10;3M";
        expect(shiftMouseRow(input, layout)).toBe(input);
    });

    it("leaves SGR row unchanged when displayed row is at or above insertedOptionRow", () => {
        // displayed row 8 (== insertedOptionRow 8) => raw row 9
        const input = "\x1b[<0;10;9M";
        expect(shiftMouseRow(input, layout)).toBe(input);
    });

    it("leaves non-escape or malformed data unchanged", () => {
        expect(shiftMouseRow("regular text", layout)).toBe("regular text");
        expect(shiftMouseRow("\x1b[other", layout)).toBe("\x1b[other");
    });
});
