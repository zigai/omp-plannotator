import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext, RegisteredCommand } from "@oh-my-pi/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import { openPlanInPlannotator } from "../../../src/plan/plan-launcher.ts";
import { createTestExtensionContext } from "../../harness/extension-ctx.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const dir of temporaryDirectories.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe("openPlanInPlannotator", () => {
    it("notifies error when plan file cannot be located", async () => {
        const { context, notifications } = createTestExtensionContext();
        const commands = new Map<string, RegisteredCommand>();

        await openPlanInPlannotator(commands, context, "nonexistent.md");

        expect(notifications).toEqual([
            { message: "Plannotator could not locate the active plan file.", type: "error" },
        ]);
    });

    it("notifies error when plannotator-annotate command is unavailable", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
        temporaryDirectories.push(tempDir);
        const planFile = join(tempDir, "plan.md");
        writeFileSync(planFile, "# Plan");

        const { context, notifications } = createTestExtensionContext({ cwd: tempDir });
        const commands = new Map<string, RegisteredCommand>();

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(notifications).toEqual([
            { message: "Plannotator annotation command is unavailable.", type: "error" },
        ]);
    });

    it("invokes plannotator-annotate with stringified resolved plan path", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
        temporaryDirectories.push(tempDir);
        const planFile = join(tempDir, "plan.md");
        writeFileSync(planFile, "# Plan");

        const { context } = createTestExtensionContext({ cwd: tempDir });
        const calls: string[] = [];
        const commands = new Map<string, RegisteredCommand>([
            [
                "plannotator-annotate",
                {
                    name: "plannotator-annotate",
                    async handler(args: string, _ctx: ExtensionCommandContext): Promise<void> {
                        calls.push(args);
                    },
                },
            ],
        ]);

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(calls).toEqual([JSON.stringify(planFile)]);
    });

    it("catches errors thrown by handler and notifies error", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
        temporaryDirectories.push(tempDir);
        const planFile = join(tempDir, "plan.md");
        writeFileSync(planFile, "# Plan");

        const { context, notifications } = createTestExtensionContext({ cwd: tempDir });
        const commands = new Map<string, RegisteredCommand>([
            [
                "plannotator-annotate",
                {
                    name: "plannotator-annotate",
                    async handler(): Promise<void> {
                        throw new Error("Failed to start UI");
                    },
                },
            ],
        ]);

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(notifications).toEqual([
            {
                message: "Failed to open the plan in Plannotator: Failed to start UI",
                type: "error",
            },
        ]);
    });

    it("adapts a base ExtensionContext into a complete ExtensionCommandContext", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
        temporaryDirectories.push(tempDir);
        const planFile = join(tempDir, "plan.md");
        writeFileSync(planFile, "# Plan");

        const { context } = createTestExtensionContext({ cwd: tempDir });
        let receivedContext: ExtensionCommandContext | undefined;
        const commands = new Map<string, RegisteredCommand>([
            [
                "plannotator-annotate",
                {
                    name: "plannotator-annotate",
                    async handler(_args: string, ctx: ExtensionCommandContext): Promise<void> {
                        receivedContext = ctx;
                    },
                },
            ],
        ]);

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(receivedContext).toBeDefined();
        if (receivedContext === undefined) {
            throw new Error("Expected receivedContext to be defined");
        }
        expect(typeof receivedContext.getContextUsage).toBe("function");
        expect(typeof receivedContext.waitForIdle).toBe("function");
        expect(typeof receivedContext.newSession).toBe("function");
        expect(typeof receivedContext.branch).toBe("function");
        expect(typeof receivedContext.switchSession).toBe("function");
        expect(typeof receivedContext.reload).toBe("function");
        expect(typeof receivedContext.navigateTree).toBe("function");
        expect(receivedContext.getContextUsage()).toBeUndefined();
        await expect(receivedContext.waitForIdle()).resolves.toBeUndefined();
        await expect(receivedContext.newSession()).resolves.toEqual({ cancelled: false });
        await expect(receivedContext.branch("entry-1")).resolves.toEqual({ cancelled: false });
        await expect(receivedContext.navigateTree("target-1")).resolves.toEqual({
            cancelled: false,
        });
        expect(receivedContext.sessionManager).toBeDefined();
        expect(receivedContext.sessionManager.getSessionId()).toBe("session-123");
    });

    it("provides safe fallback sessionManager when context lacks sessionManager", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
        temporaryDirectories.push(tempDir);
        const planFile = join(tempDir, "plan.md");
        writeFileSync(planFile, "# Plan");

        const { context } = createTestExtensionContext({
            cwd: tempDir,
            omitSessionManager: true,
            localProtocolOptions: {
                getSessionId: () => "fallback-sess-999",
            },
        });

        let receivedContext: ExtensionCommandContext | undefined;
        const commands = new Map<string, RegisteredCommand>([
            [
                "plannotator-annotate",
                {
                    name: "plannotator-annotate",
                    async handler(_args: string, ctx: ExtensionCommandContext): Promise<void> {
                        receivedContext = ctx;
                    },
                },
            ],
        ]);

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(receivedContext).toBeDefined();
        if (receivedContext === undefined) {
            throw new Error("Expected receivedContext to be defined");
        }
        expect(receivedContext.sessionManager).toBeDefined();
        expect(receivedContext.sessionManager.getSessionId()).toBe("fallback-sess-999");
        expect(receivedContext.sessionManager.getSessionFile()).toBe("fallback-sess-999.jsonl");
        expect(receivedContext.sessionManager.getBranch()).toEqual([]);
    });
});
