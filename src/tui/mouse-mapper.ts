import type { RenderedLayout } from "../types/index.ts";

/**
 * Shifts SGR mouse event rows to account for the removed body divider row
 * and inserted Plannotator option row.
 */
export function shiftMouseRow(data: string, renderedLayout: RenderedLayout): string {
    if (!data.startsWith("\x1b")) {
        return data;
    }
    const match = /^(\[<\d+;\d+;)(\d+)([Mm])$/u.exec(data.slice(1));
    if (match === null) {
        return data;
    }

    const displayedRow = Number(match[2]) - 1;
    if (
        displayedRow < renderedLayout.removeRow ||
        displayedRow >= renderedLayout.insertedOptionRow
    ) {
        return data;
    }

    return `\x1b${match[1]}${displayedRow + 2}${match[3]}`;
}
