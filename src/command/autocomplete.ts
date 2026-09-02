import type { AutocompleteItem, AutocompleteProvider } from "@oh-my-pi/pi-tui";
import {
    ANNO_COMMAND_NAME,
    PLANNOTATOR_COMMAND_NAME,
    PLANNOTATOR_GHOST_HINT,
} from "./constants.ts";

export function createPlannotatorGhostTextProvider(
    base: AutocompleteProvider,
): AutocompleteProvider {
    return new Proxy(base, {
        get(target, prop, receiver) {
            if (prop === "getSuggestions") {
                return async (
                    lines: string[],
                    line: number,
                    col: number,
                ): Promise<{ items: AutocompleteItem[]; prefix: string } | null> => {
                    const result = await target.getSuggestions(lines, line, col);
                    if (result === null) {
                        return null;
                    }
                    const items = result.items.map((item) => {
                        if (
                            item.value === ANNO_COMMAND_NAME ||
                            item.value === PLANNOTATOR_COMMAND_NAME
                        ) {
                            return {
                                ...item,
                                hint: `  ${PLANNOTATOR_GHOST_HINT}`,
                            };
                        }
                        return item;
                    });
                    return {
                        ...result,
                        items,
                    };
                };
            }
            if (prop === "applyCompletion") {
                return (
                    lines: string[],
                    cursorLine: number,
                    cursorCol: number,
                    item: AutocompleteItem,
                    prefix: string,
                ) => {
                    if (
                        item.value === ANNO_COMMAND_NAME ||
                        item.value === PLANNOTATOR_COMMAND_NAME
                    ) {
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
                    return target.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
                };
            }
            if (prop === "getInlineHint") {
                return (lines: string[], cursorLine: number, cursorCol: number): string | null => {
                    const currentLine = lines[cursorLine] ?? "";
                    const textBeforeCursor = currentLine.slice(0, cursorCol);
                    const match = /^\s*\/(?:anno|plannotator)(\s*)$/i.exec(textBeforeCursor);
                    if (match !== null) {
                        return `  ${PLANNOTATOR_GHOST_HINT}`;
                    }
                    return target.getInlineHint?.(lines, cursorLine, cursorCol) ?? null;
                };
            }

            const value: unknown = Reflect.get(target, prop, receiver);
            if (typeof value === "function") {
                // SAFETY: Preserves method binding for underlying AutocompleteProvider prototype methods.
                /* oxlint-disable-next-line antislop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion */
                return (value as (...args: unknown[]) => unknown).bind(target);
            }
            return value;
        },
    });
}
