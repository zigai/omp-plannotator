import { stripVTControlCharacters } from "node:util";
import { sliceByColumn, visibleWidth } from "@oh-my-pi/pi-tui";
import type { PlanReviewLayout } from "../types/index.ts";

export const ANNOTATE_PLAN_OPTION_LABEL = "Annotate with Plannotator";
export const PLAN_REVIEW_TITLE = "Plan Review";
export const PLAN_REVIEW_PROMPT = "Plan mode - next step";

export const HOST_OPTIONS = [
    "Approve and execute",
    "Compact context and execute",
    "Keep context and execute",
    "Refine plan",
    "Save and quit",
] as const;

export const LAST_HOST_OPTION_LABELS = ["Save and quit", "Refine plan"] as const;

export function plainText(line: string): string {
    return stripVTControlCharacters(line);
}

export function optionLabelRow(lines: readonly string[], label: string): number {
    return lines.findIndex((line) => plainText(line).includes(label));
}

export function hasSelectionCursor(line: string, label: string): boolean {
    const plain = plainText(line);
    const labelColumn = plain.indexOf(label);
    const leftBorderColumn = plain.indexOf("│");
    if (labelColumn < 0 || leftBorderColumn < 0) {
        return false;
    }
    return plain.slice(leftBorderColumn + 1, labelColumn).trim().length > 0;
}

export function isDivider(line: string): boolean {
    const plain = plainText(line).trim();
    return plain.length >= 3 && /^[\u2500-\u257f]+$/u.test(plain);
}

export function analyzePlanReviewLayout(lines: readonly string[]): PlanReviewLayout | undefined {
    if (!lines.some((line) => plainText(line).includes(PLAN_REVIEW_TITLE))) {
        return undefined;
    }
    if (!lines.some((line) => plainText(line).includes(PLAN_REVIEW_PROMPT))) {
        return undefined;
    }

    const optionRows: Array<{ readonly row: number; readonly label: string }> = [];
    for (const label of HOST_OPTIONS) {
        const row = optionLabelRow(lines, label);
        if (row >= 0) {
            optionRows.push({ row, label });
        }
    }
    if (optionRows.length === 0) {
        return undefined;
    }

    optionRows.sort((left, right) => left.row - right.row);
    let lastOption = optionRows.at(-1);
    for (const label of LAST_HOST_OPTION_LABELS) {
        const matching = optionRows.find((option) => option.label === label);
        if (matching !== undefined) {
            lastOption = matching;
            break;
        }
    }
    if (lastOption === undefined) {
        return undefined;
    }

    const lastOptionIndex = optionRows.indexOf(lastOption);
    const precedingOption = optionRows[lastOptionIndex - 1];
    if (precedingOption === undefined) {
        return undefined;
    }

    const firstOption = optionRows[0];
    if (firstOption === undefined) {
        return undefined;
    }

    let bodyDividerRow = -1;
    for (let row = firstOption.row - 1; row > 0; row -= 1) {
        if (isDivider(lines[row] ?? "")) {
            bodyDividerRow = row;
            break;
        }
    }
    const removeRow = bodyDividerRow - 1;
    if (removeRow <= 0 || removeRow >= firstOption.row) {
        return undefined;
    }

    const selectedHostOption = optionRows.find((option) =>
        hasSelectionCursor(lines[option.row] ?? "", option.label),
    );
    const unselectedTemplate = optionRows.find((option) => option !== selectedHostOption);
    if (unselectedTemplate === undefined) {
        return undefined;
    }

    return {
        actionsFocused: lines.some((line) => plainText(line).includes("↑↓ select")),
        lastHostOptionRow: lastOption.row,
        lastHostOptionLabel: lastOption.label,
        precedingHostOptionRow: precedingOption.row,
        removeRow,
        selectedHostOptionRow: selectedHostOption?.row,
        unselectedTemplateRow: unselectedTemplate.row,
    };
}

export function rebuildOptionRow(template: string, templateLabel: string, label: string): string {
    const plain = plainText(template);
    const labelColumn = plain.indexOf(templateLabel);
    const rightBorderColumn = plain.lastIndexOf("│");
    if (labelColumn < 0 || rightBorderColumn <= labelColumn) {
        return template;
    }

    const totalWidth = visibleWidth(template);
    const availableWidth = rightBorderColumn - labelColumn;
    const fittedLabel = label.slice(0, availableWidth);
    const prefix = sliceByColumn(template, 0, labelColumn);
    const suffix = sliceByColumn(template, rightBorderColumn, totalWidth - rightBorderColumn);
    const padding = " ".repeat(Math.max(0, availableWidth - visibleWidth(fittedLabel)));
    return `${prefix}${fittedLabel}${padding}${suffix}`;
}
