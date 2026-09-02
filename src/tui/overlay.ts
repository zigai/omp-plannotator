import { type Component, matchesKey, parseSgrMouse } from "@oh-my-pi/pi-tui";
import type { RenderedLayout } from "../types/index.ts";
import {
    analyzePlanReviewLayout,
    ANNOTATE_PLAN_OPTION_LABEL,
    HOST_OPTIONS,
    plainText,
    rebuildOptionRow,
} from "./layout-analyzer.ts";
import { shiftMouseRow } from "./mouse-mapper.ts";

export class PlannotatorPlanReviewOverlay implements Component {
    #insertedOptionSelected = false;
    #precedingHostOptionSelected = false;
    #renderedLayout: RenderedLayout | undefined;

    constructor(
        private readonly original: Component,
        private readonly openPlan: () => void,
        private readonly requestRender: () => void,
    ) {}

    get wantsKeyRelease(): boolean {
        return this.original.wantsKeyRelease === true;
    }

    render(width: number): readonly string[] {
        const source = this.original.render(width);
        const layout = analyzePlanReviewLayout(source);
        if (layout === undefined) {
            this.#renderedLayout = undefined;
            this.#precedingHostOptionSelected = false;
            return source;
        }

        const output: string[] = [...source];
        const selectedTemplateRow = layout.selectedHostOptionRow ?? layout.lastHostOptionRow;
        const selectedTemplate = source[selectedTemplateRow] ?? "";
        const selectedTemplateLabel =
            layout.selectedHostOptionRow === undefined
                ? layout.lastHostOptionLabel
                : (this.#labelAtRow(source, layout.selectedHostOptionRow) ??
                  layout.lastHostOptionLabel);
        const unselectedTemplate = source[layout.unselectedTemplateRow] ?? "";
        const unselectedTemplateLabel =
            this.#labelAtRow(source, layout.unselectedTemplateRow) ?? layout.lastHostOptionLabel;

        if (this.#insertedOptionSelected && layout.selectedHostOptionRow !== undefined) {
            const selectedLabel =
                this.#labelAtRow(source, layout.selectedHostOptionRow) ??
                layout.lastHostOptionLabel;
            output[layout.selectedHostOptionRow] = rebuildOptionRow(
                unselectedTemplate,
                unselectedTemplateLabel,
                selectedLabel,
            );
        }

        const insertedRow = rebuildOptionRow(
            this.#insertedOptionSelected ? selectedTemplate : unselectedTemplate,
            this.#insertedOptionSelected ? selectedTemplateLabel : unselectedTemplateLabel,
            ANNOTATE_PLAN_OPTION_LABEL,
        );

        output.splice(layout.removeRow, 1);
        const insertedOptionRow = layout.lastHostOptionRow - 1;
        output.splice(insertedOptionRow, 0, insertedRow);

        this.#renderedLayout = {
            insertedOptionRow,
            removeRow: layout.removeRow,
        };
        this.#precedingHostOptionSelected =
            layout.actionsFocused && layout.selectedHostOptionRow === layout.precedingHostOptionRow;
        return output;
    }

    handleInput(data: string): void {
        const renderedLayout = this.#renderedLayout;
        const mouse = parseSgrMouse(data);
        if (renderedLayout !== undefined && mouse !== null) {
            if (mouse.row === renderedLayout.insertedOptionRow) {
                if (mouse.wheel !== null) {
                    this.original.handleInput?.(data);
                    return;
                }
                if (mouse.motion) {
                    this.#insertedOptionSelected = true;
                    this.requestRender();
                    return;
                }
                if (mouse.leftClick) {
                    this.#choosePlannotator();
                    return;
                }
                return;
            }

            if (this.#insertedOptionSelected && mouse.motion) {
                this.#insertedOptionSelected = false;
                this.requestRender();
            }
            this.original.handleInput?.(shiftMouseRow(data, renderedLayout));
            return;
        }

        if (this.#insertedOptionSelected) {
            if (matchesKey(data, "up") || matchesKey(data, "k")) {
                this.#insertedOptionSelected = false;
                this.requestRender();
                return;
            }
            if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
                this.#choosePlannotator();
                return;
            }
            if (matchesKey(data, "down") || matchesKey(data, "j")) {
                this.#insertedOptionSelected = false;
                this.original.handleInput?.(data);
                this.requestRender();
                return;
            }
            this.#insertedOptionSelected = false;
        } else if (
            this.#precedingHostOptionSelected &&
            (matchesKey(data, "down") || matchesKey(data, "j"))
        ) {
            this.#insertedOptionSelected = true;
            this.requestRender();
            return;
        }

        this.original.handleInput?.(data);
    }

    invalidate(): void {
        this.#renderedLayout = undefined;
        this.original.invalidate?.();
    }

    setIgnoreTight(ignore: boolean): unknown {
        return this.original.setIgnoreTight?.(ignore);
    }

    dispose(): void {
        this.original.dispose?.();
    }

    #choosePlannotator(): void {
        this.#insertedOptionSelected = false;
        this.original.handleInput?.("\x1b");
        queueMicrotask(this.openPlan);
    }

    #labelAtRow(lines: readonly string[], row: number): string | undefined {
        const plain = plainText(lines[row] ?? "");
        return HOST_OPTIONS.find((label) => plain.includes(label));
    }
}
