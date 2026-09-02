import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export interface UserMessageOptions {
    readonly deliverAs?: "steer" | "followUp";
}

/**
 * Normalizes follow-up message options to immediate turns when the session context is idle.
 */
export function resolveUserMessageOptions(
    options: UserMessageOptions | undefined,
    context: ExtensionContext | undefined,
): UserMessageOptions | undefined {
    if (options?.deliverAs === "followUp" && context?.isIdle() === true) {
        return undefined;
    }
    return options;
}
