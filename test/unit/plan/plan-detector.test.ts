import type { ToolCallEvent } from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { planPathFromToolCall } from "../../../src/plan/plan-detector.ts";

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
