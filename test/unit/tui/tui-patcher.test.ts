import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
    ExtensionAPI,
    ExtensionCommandContext,
    ExtensionContext,
    ExtensionHandler,
    RegisteredCommand,
    ToolCallEvent,
} from "@oh-my-pi/pi-coding-agent";
import type { Component, TUI } from "@oh-my-pi/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOST_OPTIONS } from "../../../src/tui/layout-analyzer.ts";
import { PlannotatorPlanReviewOverlay } from "../../../src/tui/overlay.ts";
import { installPlanReviewPlannotatorHook } from "../../../src/tui/tui-patcher.ts";
import { FakePlanReviewOverlay } from "../../harness/tui-overlay.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

describe("installPlanReviewPlannotatorHook", () => {
    it("patches the real TUI instance and invokes annotate with the on-disk local plan", async () => {
        const handlers = new Map<string, Array<ExtensionHandler<unknown, unknown>>>();
        let shownOverlay: Component | undefined;
        const tui = {
            terminal: { columns: 80 },
            requestRender: vi.fn(),
            showOverlay(component: Component) {
                shownOverlay = component;
                return {
                    hide(): void {},
                    setHidden(hidden: boolean): void {
                        void hidden;
                    },
                };
            },
        };
        const api = {
            on(event: string, handler: ExtensionHandler<unknown, unknown>): void {
                const eventHandlers = handlers.get(event) ?? [];
                eventHandlers.push(handler);
                handlers.set(event, eventHandlers);
            },
        };
        const commandCalls: Array<{
            readonly args: string;
            readonly context: ExtensionCommandContext;
        }> = [];
        const commands = new Map<string, RegisteredCommand>([
            [
                "plannotator-annotate",
                {
                    name: "plannotator-annotate",
                    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
                        commandCalls.push({ args, context });
                    },
                },
            ],
        ]);
        const artifactDirectory = mkdtempSync(join(tmpdir(), "omp-plannotator-hook-"));
        temporaryDirectories.push(artifactDirectory);
        const localDirectory = join(artifactDirectory, "local");
        const planPath = join(localDirectory, "architecture-plan.md");
        mkdirSync(localDirectory, { recursive: true });
        writeFileSync(planPath, "# Architecture\n");

        const context = {
            cwd: "/workspace",
            hasUI: true,
            localProtocolOptions: {
                getArtifactsDir: () => artifactDirectory,
                getSessionId: () => "session-123",
            },
            sessionManager: {
                getSessionId: () => "session-123",
            },
            ui: {
                notify: vi.fn(),
                async custom<T>(
                    factory: (
                        tuiInstance: TUI,
                        theme: unknown,
                        keybindings: unknown,
                        done: (value: T) => void,
                    ) => Component,
                ): Promise<T> {
                    return new Promise<T>((resolvePromise) => {
                        // SAFETY: Structural test fake for TUI.
                        /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
                        factory(tui as unknown as TUI, {}, {}, resolvePromise);
                    });
                },
            },
        };
        // SAFETY: Structural test fake for ExtensionAPI.
        /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
        installPlanReviewPlannotatorHook(api as unknown as ExtensionAPI, commands);

        for (const handler of handlers.get("session_start") ?? []) {
            // SAFETY: Structural test fake for ExtensionContext.
            /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
            await handler({}, context as unknown as ExtensionContext);
        }
        const toolEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "write-plan",
            toolName: "write",
            input: { path: "local://architecture-plan.md", content: "# Architecture\n" },
        };
        for (const handler of handlers.get("tool_call") ?? []) {
            // SAFETY: Structural test fake for ExtensionContext.
            /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
            await handler(toolEvent, context as unknown as ExtensionContext);
        }

        // SAFETY: Structural test fake for TUI.
        /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
        (tui as unknown as TUI).showOverlay(new FakePlanReviewOverlay(HOST_OPTIONS.length - 2));
        expect(shownOverlay).toBeInstanceOf(PlannotatorPlanReviewOverlay);
        if (!(shownOverlay instanceof PlannotatorPlanReviewOverlay)) {
            throw new Error(
                "Expected shownOverlay to be an instance of PlannotatorPlanReviewOverlay",
            );
        }
        shownOverlay.render(80);
        shownOverlay.handleInput?.("\x1b[B");
        shownOverlay.handleInput?.("\r");
        await Promise.resolve();
        await Promise.resolve();

        expect(commandCalls).toHaveLength(1);
        expect(commandCalls[0]?.args).toBe(JSON.stringify(planPath));
        expect(commandCalls[0]?.context.cwd).toBe(context.cwd);
        expect(commandCalls[0]?.context.hasUI).toBe(context.hasUI);
    });
});
