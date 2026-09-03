import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
    ExtensionCommandContext,
    RegisteredCommand,
    ToolCallEvent,
} from "@oh-my-pi/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import {
    openPlanInPlannotator,
    planPathFromToolCall,
    resolveExistingPlanPath,
    resolveLocalPath,
} from "../../src/plan.ts";
import { createTempPlanFixture, createTestExtensionContext } from "../harness/extension-ctx.ts";

const cleanups: Array<() => void> = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
        cleanup();
    }
    for (const dir of temporaryDirectories.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe("planPathFromToolCall", () => {
    it("returns undefined for non-write and non-edit tools", () => {
        const event: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "1",
            toolName: "bash",
            input: { command: "echo hi" },
        };
        expect(planPathFromToolCall(event)).toBeUndefined();
    });

    it("returns undefined when path is missing or non-string", () => {
        const event: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "2",
            toolName: "write",
            input: {},
        };
        expect(planPathFromToolCall(event)).toBeUndefined();
    });

    it.each([
        ["plan.md", "plan.md"],
        ["PLAN.MD", "PLAN.MD"],
        ["local://plan.md", "local://plan.md"],
        ["docs/feature-plan.md", "docs/feature-plan.md"],
        ["specs/my_cool_plan.md", "specs/my_cool_plan.md"],
        ["C:\\plans\\sub-plan.md", "C:\\plans\\sub-plan.md"],
    ])("recognizes %s as a plan path", (path, expected) => {
        const event: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "3",
            toolName: "write",
            input: { path },
        };
        expect(planPathFromToolCall(event)).toBe(expected);
    });

    it.each(["src/index.ts", "README.md", "planner.md", "plan.txt", "myplan.md"])(
        "ignores non-plan path %s",
        (path) => {
            const event: ToolCallEvent = {
                type: "tool_call",
                toolCallId: "4",
                toolName: "edit",
                input: { path },
            };
            expect(planPathFromToolCall(event)).toBeUndefined();
        },
    );
});

describe("resolveLocalPath", () => {
    it("resolves valid local path within artifacts directory", () => {
        const artifactsDir = mkdtempSync(join(tmpdir(), "omp-test-artifacts-"));
        temporaryDirectories.push(artifactsDir);

        const { context } = createTestExtensionContext({
            localProtocolOptions: {
                getArtifactsDir: () => artifactsDir,
                getSessionId: () => "sess-1",
            },
        });

        const resolved = resolveLocalPath("local://PLAN.md", context);
        expect(resolved).toBe(join(artifactsDir, "local", "PLAN.md"));
    });

    it("rejects path traversal attempts with ..", () => {
        const artifactsDir = mkdtempSync(join(tmpdir(), "omp-test-artifacts-"));
        temporaryDirectories.push(artifactsDir);

        const { context } = createTestExtensionContext({
            localProtocolOptions: {
                getArtifactsDir: () => artifactsDir,
            },
        });

        expect(resolveLocalPath("local://../secret.txt", context)).toBeUndefined();
        expect(resolveLocalPath("local://nested/../../secret.txt", context)).toBeUndefined();
    });

    it("rejects absolute paths inside local URI", () => {
        const { context } = createTestExtensionContext();
        expect(resolveLocalPath("local:///etc/passwd", context)).toBeUndefined();
    });
});

describe("resolveExistingPlanPath", () => {
    it("returns candidate path when on-disk file exists", () => {
        const { tempDir, planFile, cleanup } = createTempPlanFixture(
            "custom-plan.md",
            "# Custom Plan",
        );
        temporaryDirectories.push(tempDir);
        void cleanup;

        const { context } = createTestExtensionContext({ cwd: tempDir });
        const resolved = resolveExistingPlanPath("custom-plan.md", context);

        expect(resolved).toBe(planFile);
    });

    it("falls back to default local://PLAN.md when candidate is undefined and default exists", () => {
        const artifactsDir = mkdtempSync(join(tmpdir(), "omp-test-artifacts-"));
        temporaryDirectories.push(artifactsDir);
        const localDir = join(artifactsDir, "local");
        mkdirSync(localDir, { recursive: true });
        const defaultPlanFile = join(localDir, "PLAN.md");
        writeFileSync(defaultPlanFile, "# Default Plan");

        const { context } = createTestExtensionContext({
            localProtocolOptions: {
                getArtifactsDir: () => artifactsDir,
            },
        });

        const resolved = resolveExistingPlanPath(undefined, context);
        expect(resolved).toBe(defaultPlanFile);
    });

    it("returns undefined when neither candidate nor default file exists on disk", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-empty-"));
        temporaryDirectories.push(tempDir);

        const { context } = createTestExtensionContext({ cwd: tempDir });
        const resolved = resolveExistingPlanPath("nonexistent-plan.md", context);

        expect(resolved).toBeUndefined();
    });
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
        const fixture = createTempPlanFixture();
        cleanups.push(fixture.cleanup);
        const { tempDir } = fixture;
        const { context, notifications } = createTestExtensionContext({ cwd: tempDir });
        const commands = new Map<string, RegisteredCommand>();

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(notifications).toEqual([
            { message: "Plannotator annotation command is unavailable.", type: "error" },
        ]);
    });

    it("invokes plannotator-annotate with stringified resolved plan path", async () => {
        const fixture = createTempPlanFixture();
        cleanups.push(fixture.cleanup);
        const { tempDir, planFile } = fixture;
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
        const fixture = createTempPlanFixture();
        cleanups.push(fixture.cleanup);
        const { tempDir } = fixture;
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

    it("invokes annotate command handler with resolved plan file path and delegating context", async () => {
        const fixture = createTempPlanFixture();
        cleanups.push(fixture.cleanup);
        const { tempDir, planFile } = fixture;
        const { context } = createTestExtensionContext({ cwd: tempDir });
        let receivedArgs: string | undefined;
        let receivedContext: ExtensionCommandContext | undefined;
        const commands = new Map<string, RegisteredCommand>([
            [
                "plannotator-annotate",
                {
                    name: "plannotator-annotate",
                    async handler(args: string, ctx: ExtensionCommandContext): Promise<void> {
                        receivedArgs = args;
                        receivedContext = ctx;
                    },
                },
            ],
        ]);

        await openPlanInPlannotator(commands, context, "plan.md");

        expect(receivedArgs).toBe(JSON.stringify(planFile));
        expect(receivedContext).toBeDefined();
        if (receivedContext === undefined) {
            throw new Error("Expected receivedContext to be defined");
        }
        expect(receivedContext.cwd).toBe(tempDir);
        expect(receivedContext.ui).toBe(context.ui);
        expect(receivedContext.sessionManager).toBe(context.sessionManager);
    });
});
