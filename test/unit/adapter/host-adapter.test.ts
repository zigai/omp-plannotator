import type {
    ExtensionCommandContext,
    ExtensionContext,
    ToolCallEvent,
} from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { createOmpPlannotatorHostAdapter } from "../../../src/adapter/host-adapter.ts";
import { createRecordingApiHarness } from "../../harness/extension-api.ts";
import { createTestExtensionContext } from "../../harness/extension-ctx.ts";

describe("createOmpPlannotatorHostAdapter - sendUserMessage", () => {
    it("translates explicit followUp to immediate turn when session is idle", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        const { context: idleContext } = createTestExtensionContext({ idle: true });
        await harness.emitEvent("session_start", {}, idleContext);

        adapter.api.sendUserMessage("Review completed", { deliverAs: "followUp" });

        expect(harness.sentUserMessages).toHaveLength(1);
        expect(harness.sentUserMessages[0]).toEqual({
            content: "Review completed",
            options: undefined,
        });
    });

    it("preserves explicit followUp when session is streaming (not idle)", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        const { context: streamingContext } = createTestExtensionContext({ idle: false });
        await harness.emitEvent("session_start", {}, streamingContext);

        adapter.api.sendUserMessage("Review completed", { deliverAs: "followUp" });

        expect(harness.sentUserMessages).toHaveLength(1);
        expect(harness.sentUserMessages[0]).toEqual({
            content: "Review completed",
            options: { deliverAs: "followUp" },
        });
    });

    it("preserves steer delivery mode unchanged even when idle", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        const { context: idleContext } = createTestExtensionContext({ idle: true });
        await harness.emitEvent("session_start", {}, idleContext);

        adapter.api.sendUserMessage("Steer guidance", { deliverAs: "steer" });

        expect(harness.sentUserMessages).toHaveLength(1);
        expect(harness.sentUserMessages[0]).toEqual({
            content: "Steer guidance",
            options: { deliverAs: "steer" },
        });
    });

    it("preserves default send without options", () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        adapter.api.sendUserMessage("Direct prompt");

        expect(harness.sentUserMessages).toHaveLength(1);
        expect(harness.sentUserMessages[0]).toEqual({
            content: "Direct prompt",
            options: undefined,
        });
    });

    it("clears tracked session context on session_shutdown", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        const { context: idleContext } = createTestExtensionContext({ idle: true });
        await harness.emitEvent("session_start", {}, idleContext);
        await harness.emitEvent("session_shutdown", {}, idleContext);

        adapter.api.sendUserMessage("Post shutdown", { deliverAs: "followUp" });

        // After shutdown, without active context, options are preserved unchanged
        expect(harness.sentUserMessages).toHaveLength(1);
        expect(harness.sentUserMessages[0]).toEqual({
            content: "Post shutdown",
            options: { deliverAs: "followUp" },
        });
    });
});

describe("createOmpPlannotatorHostAdapter - registerCommand", () => {
    it("retains registered commands privately without exposing upstream slash commands", () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        const dummyHandler = async (_args: string, _ctx: ExtensionCommandContext) => {};
        adapter.api.registerCommand("plannotator-review", {
            description: "Review changes",
            handler: dummyHandler,
        });

        expect(adapter.commands.has("plannotator-review")).toBe(true);
        expect(adapter.commands.get("plannotator-review")?.description).toBe("Review changes");
        expect(harness.registeredCommands).toHaveLength(0);
    });
});

describe("createOmpPlannotatorHostAdapter - tool_call interception", () => {
    it("fans out multi-section hashline edit and passes each concrete path to wrapped handler", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        const evaluatedPaths: string[] = [];
        adapter.api.on("tool_call", (event: ToolCallEvent, _ctx: ExtensionContext) => {
            if ("path" in event.input && typeof event.input.path === "string") {
                evaluatedPaths.push(event.input.path);
            }
            return undefined;
        });

        const { context } = createTestExtensionContext({ cwd: "/workspace" });
        const hostHandler = harness.handlers.get("tool_call")?.[0];
        expect(hostHandler).toBeDefined();

        const hashlineInput =
            "[plans/section1.md#1A2B]\nPUT 1:\n+# Section 1\n[plans/section2.md#3C4D]\nPUT 1:\n+# Section 2";
        const toolEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "call-1",
            toolName: "edit",
            input: { input: hashlineInput },
        };
        expect(hostHandler).toBeDefined();
        if (hostHandler === undefined) {
            throw new Error("Expected hostHandler to be registered");
        }
        await hostHandler(toolEvent, context);
        expect(evaluatedPaths).toEqual(["plans/section1.md", "plans/section2.md"]);
    });

    it("returns first blocking result when a non-markdown file is targeted in hashline", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        adapter.api.on("tool_call", (event: ToolCallEvent, _ctx: ExtensionContext) => {
            if (
                "path" in event.input &&
                typeof event.input.path === "string" &&
                event.input.path.endsWith(".ts")
            ) {
                return {
                    block: true,
                    reason: `Blocked non-markdown file: ${event.input.path}`,
                };
            }
            return undefined;
        });

        const { context } = createTestExtensionContext({ cwd: "/workspace" });
        const hostHandler = harness.handlers.get("tool_call")?.[0];

        const hashlineInput =
            "[plans/allowed.md#1A2B]\nPUT 1:\n+# Allowed\n[src/blocked.ts#3C4D]\nPUT 1:\n+const x = 1;\n[plans/never.md#5E6F]\nPUT 1:\n+# Never";
        const toolEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "call-block",
            toolName: "edit",
            input: { input: hashlineInput },
        };
        expect(hostHandler).toBeDefined();
        if (hostHandler === undefined) {
            throw new Error("Expected hostHandler to be registered");
        }
        const result = await hostHandler(toolEvent, context);
        expect(result).toEqual({
            block: true,
            reason: "Blocked non-markdown file: src/blocked.ts",
        });
    });

    it("invokes handler directly with original event when edit targets cannot be extracted", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        let receivedEvent: ToolCallEvent | undefined;
        adapter.api.on("tool_call", (event: ToolCallEvent, _ctx: ExtensionContext) => {
            receivedEvent = event;
            return undefined;
        });

        const { context } = createTestExtensionContext({ cwd: "/workspace" });
        const hostHandler = harness.handlers.get("tool_call")?.[0];

        const toolEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "call-empty",
            toolName: "edit",
            input: {},
        };
        expect(hostHandler).toBeDefined();
        if (hostHandler === undefined) {
            throw new Error("Expected hostHandler to be registered");
        }
        await hostHandler(toolEvent, context);
        expect(receivedEvent).toBe(toolEvent);
    });

    it("passes through non-edit tool calls directly to wrapped handler without path modification", async () => {
        const harness = createRecordingApiHarness();
        const adapter = createOmpPlannotatorHostAdapter(harness.api);

        let receivedEvent: ToolCallEvent | undefined;
        adapter.api.on("tool_call", (event: ToolCallEvent, _ctx: ExtensionContext) => {
            receivedEvent = event;
            return undefined;
        });

        const { context } = createTestExtensionContext({ cwd: "/workspace" });
        const hostHandler = harness.handlers.get("tool_call")?.[0];

        const toolEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "call-bash",
            toolName: "bash",
            input: { command: "git status" },
        };
        expect(hostHandler).toBeDefined();
        if (hostHandler === undefined) {
            throw new Error("Expected hostHandler to be registered");
        }
        await hostHandler(toolEvent, context);
        expect(receivedEvent).toBe(toolEvent);
    });
});
