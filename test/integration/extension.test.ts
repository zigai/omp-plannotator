import type { ToolCallEvent, ToolCallEventResult } from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it } from "vitest";
import ompPlannotator from "../../src/index.ts";
import { createRecordingApiHarness } from "../harness/extension-api.ts";
import { createTestExtensionContext } from "../harness/extension-ctx.ts";

describe("omp-plannotator integration", () => {
    it("exposes unified /anno and /plannotator while preserving upstream non-command surfaces", () => {
        const harness = createRecordingApiHarness();
        ompPlannotator(harness.api);

        expect(Array.from(harness.commands.keys())).toEqual(["anno", "plannotator"]);

        // Upstream tool, flag, and shortcut
        expect(harness.tools.has("plannotator_submit_plan")).toBe(true);
        expect(harness.flags.has("plan")).toBe(true);
        expect(harness.shortcuts.size).toBeGreaterThan(0);
        expect(harness.shortcuts.has("alt+shift+a")).toBe(true);
        expect(harness.shortcuts.get("alt+shift+a")?.description).toBe(
            "Annotate last assistant response in Plannotator",
        );
        expect(harness.shortcuts.has("alt+shift+d")).toBe(true);
        expect(harness.shortcuts.get("alt+shift+d")?.description).toBe(
            "Review working tree diff in Plannotator",
        );
        expect(harness.handlers.get("session_start")?.length).toBeGreaterThan(1);
        expect(harness.handlers.get("session_shutdown")?.length).toBeGreaterThan(1);
    });

    it("exercises real upstream plan-mode and blocks non-markdown edits while permitting markdown edits", async () => {
        const harness = createRecordingApiHarness({ startInPlanMode: true });
        ompPlannotator(harness.api);

        const { context } = createTestExtensionContext({ cwd: "/workspace" });
        await harness.emitEvent("session_start", {}, context);

        // Verify that a pure markdown hashline edit is permitted (not blocked)
        const markdownEditEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "edit-1",
            toolName: "edit",
            input: {
                input: "[plans/draft.md#1A2B]\nPUT 1:\n+# Architecture Plan",
            },
        };

        const mdResult = await harness.emitEvent<ToolCallEvent, ToolCallEventResult>(
            "tool_call",
            markdownEditEvent,
            context,
        );
        expect(mdResult).toBeUndefined();

        // Verify that a mixed markdown/TypeScript hashline edit is blocked by upstream gate
        const mixedEditEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "edit-2",
            toolName: "edit",
            input: {
                input: "[plans/draft.md#1A2B]\nPUT 1:\n+# Plan\n[src/index.ts#3C4D]\nPUT 1:\n+export const x = 1;",
            },
        };

        const mixedResult = await harness.emitEvent<ToolCallEvent, ToolCallEventResult>(
            "tool_call",
            mixedEditEvent,
            context,
        );
        expect(mixedResult).toBeDefined();
        expect(mixedResult?.block).toBe(true);
        expect(mixedResult?.reason).toContain(
            "Plannotator: during planning, edits are limited to markdown files (.md, .mdx) inside the working directory. Blocked: src/index.ts",
        );

        // Verify that a non-markdown write tool call is blocked by upstream gate
        const tsWriteEvent: ToolCallEvent = {
            type: "tool_call",
            toolCallId: "write-1",
            toolName: "write",
            input: {
                path: "src/server.ts",
                content: "console.log('hi');",
            },
        };

        const writeResult = await harness.emitEvent<ToolCallEvent, ToolCallEventResult>(
            "tool_call",
            tsWriteEvent,
            context,
        );
        expect(writeResult).toBeDefined();
        expect(writeResult?.block).toBe(true);
        expect(writeResult?.reason).toContain(
            "Plannotator: during planning, writes are limited to markdown files (.md, .mdx) inside the working directory. Blocked: src/server.ts",
        );
    });
});
