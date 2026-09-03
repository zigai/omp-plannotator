import type { AutocompleteProvider } from "@oh-my-pi/pi-tui";
import {
    ANNO_COMMAND_NAME,
    PLANNOTATOR_COMMAND_NAME,
    PLANNOTATOR_GHOST_HINT,
} from "./constants.ts";

export function createPlannotatorGhostTextProvider(
    base: AutocompleteProvider,
): AutocompleteProvider {
    return {
        ...base,
        async getSuggestions(lines, line, col) {
            const result = await base.getSuggestions(lines, line, col);
            if (!result) return null;
            return {
                ...result,
                items: result.items.map((item) =>
                    item.value === ANNO_COMMAND_NAME || item.value === PLANNOTATOR_COMMAND_NAME
                        ? { ...item, hint: `  ${PLANNOTATOR_GHOST_HINT}` }
                        : item,
                ),
            };
        },
        applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
            if (item.value === ANNO_COMMAND_NAME || item.value === PLANNOTATOR_COMMAND_NAME) {
                const currentLine = lines[cursorLine] ?? "";
                const leadingSlashStart = currentLine.lastIndexOf("/", cursorCol);
                const beforeSlash =
                    leadingSlashStart >= 0 ? currentLine.slice(0, leadingSlashStart) : "";
                const afterCursor = currentLine.slice(cursorCol);
                const newLine = `${beforeSlash}/${item.value}${afterCursor}`;
                const newLines = [...lines];
                newLines[cursorLine] = newLine;
                return {
                    lines: newLines,
                    cursorLine,
                    cursorCol: beforeSlash.length + item.value.length + 1,
                };
            }
            return base.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
        },
        getInlineHint(lines, cursorLine, cursorCol) {
            const currentLine = lines[cursorLine] ?? "";
            const textBeforeCursor = currentLine.slice(0, cursorCol);
            if (/^\s*\/(?:anno|plannotator)(\s*)$/iu.test(textBeforeCursor)) {
                return `  ${PLANNOTATOR_GHOST_HINT}`;
            }
            return base.getInlineHint?.(lines, cursorLine, cursorCol) ?? null;
        },
    };
}
