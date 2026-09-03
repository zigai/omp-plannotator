import { parseSgrMouse } from "@oh-my-pi/pi-tui";
import type { RenderedLayout } from "../types/index.ts";

/**
 * Shifts SGR mouse event rows to account for the removed body divider row
 * and inserted Plannotator option row.
 */
export function shiftMouseRow(data: string, renderedLayout: RenderedLayout): string {
    const mouse = parseSgrMouse(data);
    if (mouse === null) {
        return data;
    }

    if (mouse.row < renderedLayout.removeRow || mouse.row >= renderedLayout.insertedOptionRow) {
        return data;
    }

    return `\x1b[<${mouse.button};${mouse.col + 1};${mouse.row + 2}${mouse.release ? "m" : "M"}`;
}
