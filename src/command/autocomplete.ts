import type { AutocompleteProvider } from "@oh-my-pi/pi-tui";
import {
    ANNO_COMMAND_NAME,
    ANNO_SUBCOMMANDS,
    PLANNOTATOR_COMMAND_NAME,
    PLANNOTATOR_GHOST_HINT,
} from "./constants.ts";

export function getAnnoInlineHint(textBeforeCursor: string): string | null {
    if (/^\s*\/(?:anno|plannotator)$/iu.test(textBeforeCursor)) {
        return ` ${PLANNOTATOR_GHOST_HINT}`;
    }

    const argMatch = /^\s*\/(?:anno|plannotator)(\s+)(.*)$/iu.exec(textBeforeCursor);
    if (argMatch === null) {
        return null;
    }

    const argText = argMatch[2] ?? "";
    if (argText.length === 0) {
        return PLANNOTATOR_GHOST_HINT;
    }

    const spaceIndex = argText.indexOf(" ");
    if (spaceIndex === -1) {
        const lower = argText.toLowerCase();
        const match = ANNO_SUBCOMMANDS.find((s) => s.name.startsWith(lower));
        if (match !== undefined) {
            const remaining = match.name.slice(lower.length);
            const usagePart =
                typeof match.usage === "string" && match.usage.length > 0 ? ` ${match.usage}` : "";
            const result = remaining + usagePart;
            return result.length > 0 ? result : null;
        }
        return null;
    }

    const subName = argText.slice(0, spaceIndex).toLowerCase();
    const afterSub = argText.slice(spaceIndex + 1);
    const sub = ANNO_SUBCOMMANDS.find((s) => s.name === subName);
    if (typeof sub?.usage === "string" && sub.usage.length > 0 && afterSub.length === 0) {
        return sub.usage;
    }

    return null;
}

export function createPlannotatorGhostTextProvider(
    base: AutocompleteProvider,
): AutocompleteProvider {
    const provider: AutocompleteProvider = {
        async getSuggestions(lines: string[], line: number, col: number) {
            const currentLine = lines[line] ?? "";
            const textBeforeCursor = currentLine.slice(0, col);
            if (/^\s*\/(?:anno|plannotator)(?:\s.*)?$/iu.test(textBeforeCursor)) {
                return null;
            }

            const result = await base.getSuggestions(lines, line, col);
            if (!result) return null;
            return {
                ...result,
                items: result.items.map((item) =>
                    item.value === ANNO_COMMAND_NAME || item.value === PLANNOTATOR_COMMAND_NAME
                        ? { ...item, hint: ` ${PLANNOTATOR_GHOST_HINT}` }
                        : item,
                ),
            };
        },
        applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
            return base.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
        },
        getInlineHint(lines: string[], cursorLine: number, cursorCol: number) {
            const currentLine = lines[cursorLine] ?? "";
            const textBeforeCursor = currentLine.slice(0, cursorCol);
            const hint = getAnnoInlineHint(textBeforeCursor);
            if (hint !== null) {
                return hint;
            }
            return base.getInlineHint?.(lines, cursorLine, cursorCol) ?? null;
        },
        trySyncSlashCompletion(textBeforeCursor: string) {
            return base.trySyncSlashCompletion?.(textBeforeCursor) ?? null;
        },
        trySyncInlineReplace(textBeforeCursor: string) {
            return base.trySyncInlineReplace?.(textBeforeCursor) ?? null;
        },
        shouldTriggerFileCompletion(lines: string[], cursorLine: number, cursorCol: number) {
            return base.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
        },
    };
    if (base.getForceFileSuggestions !== undefined) {
        provider.getForceFileSuggestions = (lines, cursorLine, cursorCol) =>
            base.getForceFileSuggestions!(lines, cursorLine, cursorCol);
    }
    return provider;
}
