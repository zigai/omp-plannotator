import { stripVTControlCharacters } from "node:util";
import type { Component } from "@oh-my-pi/pi-tui";
import { vi } from "vitest";
import { HOST_OPTIONS } from "../../src/tui/layout-analyzer.ts";
import { PlannotatorPlanReviewOverlay } from "../../src/tui/overlay.ts";

export class FakePlanReviewOverlay implements Component {
    readonly inputs: string[] = [];
    selectedIndex: number;

    constructor(selectedIndex = 0) {
        this.selectedIndex = selectedIndex;
    }

    render(width: number): readonly string[] {
        void width;
        const rows: string[] = [
            "╭──────── Plan Review ────────╮",
            "│ body one                    │",
            "│ body two                    │",
            "│ body three                  │",
            "├──────────────┴──────────────┤",
            "│ Plan mode - next step       │",
        ];
        for (let index = 0; index < HOST_OPTIONS.length; index += 1) {
            const cursor = index === this.selectedIndex ? " " : "  ";
            const option = HOST_OPTIONS[index] ?? "";
            rows.push(`│ ${cursor}${option.padEnd(25)}│`);
        }
        rows.push("│ ↑↓ select · ⏎ confirm       │");
        rows.push("╰─────────────────────────────╯");
        return rows;
    }

    handleInput(data: string): void {
        this.inputs.push(data);
        if (data === "\x1b[B" || data === "j") {
            this.selectedIndex = (this.selectedIndex + 1) % HOST_OPTIONS.length;
            return;
        }
        if (data === "\x1b[A" || data === "k") {
            this.selectedIndex =
                (this.selectedIndex + HOST_OPTIONS.length - 1) % HOST_OPTIONS.length;
        }
    }
}

export function renderedPlainLines(component: Component): readonly string[] {
    return component.render(80).map((line) => stripVTControlCharacters(line));
}

export function createDecoratedOverlay(selectedIndex = 0) {
    const original = new FakePlanReviewOverlay(selectedIndex);
    const opened = { count: 0 };
    const requestRender = vi.fn();
    const overlay = new PlannotatorPlanReviewOverlay(
        original,
        () => {
            opened.count += 1;
        },
        requestRender,
    );
    return { original, overlay, opened, requestRender };
}
