import type { ToolCallEvent } from "@oh-my-pi/pi-coding-agent";

/**
 * Identifies if a tool call targets an active plan file and returns its path.
 */
export function planPathFromToolCall(event: ToolCallEvent): string | undefined {
    if (event.toolName !== "write" && event.toolName !== "edit") {
        return undefined;
    }

    const path = event.input.path;
    if (typeof path !== "string") {
        return undefined;
    }

    const basename = path.replaceAll("\\", "/").split("/").at(-1)?.toLowerCase();
    if (
        basename === "plan.md" ||
        basename?.endsWith("-plan.md") === true ||
        basename?.endsWith("_plan.md") === true
    ) {
        return path;
    }
    return undefined;
}
