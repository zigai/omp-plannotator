import type {
    ContextUsage,
    ExtensionCommandContext,
    ExtensionContext,
    RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { resolveExistingPlanPath } from "./uri-resolver.ts";
function toCommandContext(context: ExtensionContext): ExtensionCommandContext {
    // SAFETY: Proxy preserves all underlying ExtensionContext prototype getters (sessionManager, cwd, ui)
    // while providing safe fallback implementations for missing ExtensionCommandContext methods.
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion */
    return new Proxy(context, {
        get(target, prop, receiver) {
            if (prop === "getContextUsage") {
                const fn: unknown = Reflect.get(target, "getContextUsage");
                if (typeof fn === "function") {
                    return (): ContextUsage | undefined => {
                        const result: unknown = Reflect.apply(fn, target, []);
                        if (
                            result !== null &&
                            typeof result === "object" &&
                            "tokens" in result &&
                            typeof result.tokens === "number" &&
                            "contextWindow" in result &&
                            typeof result.contextWindow === "number" &&
                            "percent" in result &&
                            typeof result.percent === "number"
                        ) {
                            return {
                                tokens: result.tokens,
                                contextWindow: result.contextWindow,
                                percent: result.percent,
                            };
                        }
                        return undefined;
                    };
                }
                return (): ContextUsage | undefined => undefined;
            }
            if (prop === "waitForIdle") {
                const fn: unknown = Reflect.get(target, "waitForIdle");
                if (typeof fn === "function") {
                    return async (): Promise<void> => {
                        await Reflect.apply(fn, target, []);
                    };
                }
                return async (): Promise<void> => {};
            }
            if (prop === "newSession") {
                const fn: unknown = Reflect.get(target, "newSession");
                if (typeof fn === "function") {
                    return async (options?: unknown): Promise<{ cancelled: boolean }> => {
                        const result: unknown = await Reflect.apply(fn, target, [options]);
                        if (
                            result !== null &&
                            typeof result === "object" &&
                            "cancelled" in result
                        ) {
                            return { cancelled: Boolean(result.cancelled) };
                        }
                        return { cancelled: false };
                    };
                }
                return async (): Promise<{ cancelled: boolean }> => ({ cancelled: false });
            }
            if (prop === "branch") {
                const fn: unknown = Reflect.get(target, "branch");
                if (typeof fn === "function") {
                    return async (entryId: string): Promise<{ cancelled: boolean }> => {
                        const result: unknown = await Reflect.apply(fn, target, [entryId]);
                        if (
                            result !== null &&
                            typeof result === "object" &&
                            "cancelled" in result
                        ) {
                            return { cancelled: Boolean(result.cancelled) };
                        }
                        return { cancelled: false };
                    };
                }
                return async (): Promise<{ cancelled: boolean }> => ({ cancelled: false });
            }
            if (prop === "switchSession") {
                const fn: unknown = Reflect.get(target, "switchSession");
                if (typeof fn === "function") {
                    return async (sessionPath: string): Promise<{ cancelled: boolean }> => {
                        const result: unknown = await Reflect.apply(fn, target, [sessionPath]);
                        if (
                            result !== null &&
                            typeof result === "object" &&
                            "cancelled" in result
                        ) {
                            return { cancelled: Boolean(result.cancelled) };
                        }
                        return { cancelled: false };
                    };
                }
                return async (): Promise<{ cancelled: boolean }> => ({ cancelled: false });
            }
            if (prop === "reload") {
                const fn: unknown = Reflect.get(target, "reload");
                if (typeof fn === "function") {
                    return async (): Promise<void> => {
                        await Reflect.apply(fn, target, []);
                    };
                }
                return async (): Promise<void> => {};
            }
            if (prop === "navigateTree") {
                const fn: unknown = Reflect.get(target, "navigateTree");
                if (typeof fn === "function") {
                    return async (
                        targetId: string,
                        options?: unknown,
                    ): Promise<{ cancelled: boolean }> => {
                        const result: unknown = await Reflect.apply(fn, target, [
                            targetId,
                            options,
                        ]);
                        if (
                            result !== null &&
                            typeof result === "object" &&
                            "cancelled" in result
                        ) {
                            return { cancelled: Boolean(result.cancelled) };
                        }
                        return { cancelled: false };
                    };
                }
                return async (): Promise<{ cancelled: boolean }> => ({ cancelled: false });
            }
            if (prop === "sessionManager") {
                const manager: unknown = Reflect.get(target, "sessionManager", receiver);
                if (manager !== undefined && manager !== null) {
                    return manager;
                }
                const localOptions: unknown = Reflect.get(target, "localProtocolOptions", receiver);
                let fallbackSessionId = "session";
                if (
                    localOptions !== null &&
                    typeof localOptions === "object" &&
                    "getSessionId" in localOptions &&
                    typeof localOptions.getSessionId === "function"
                ) {
                    const id: unknown = Reflect.apply(localOptions.getSessionId, localOptions, []);
                    if (typeof id === "string" && id.length > 0) {
                        fallbackSessionId = id;
                    }
                }
                return {
                    getSessionId: () => fallbackSessionId,
                    getSessionFile: () => `${fallbackSessionId}.jsonl`,
                    getSessionName: () => undefined,
                    getBranch: () => [],
                    getEntries: () => [],
                    getLeafId: () => "leaf-1",
                };
            }

            const value: unknown = Reflect.get(target, prop, receiver);
            if (typeof value === "function") {
                // SAFETY: Preserves method binding for underlying host ExtensionContext methods.
                /* oxlint-disable-next-line antislop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion */
                return (value as (...args: unknown[]) => unknown).bind(target);
            }
            return value;
        },
    }) as ExtensionCommandContext;
}

export async function openPlanInPlannotator(
    commands: ReadonlyMap<string, RegisteredCommand>,
    context: ExtensionContext | undefined,
    planPath: string | undefined,
): Promise<void> {
    if (context === undefined) {
        return;
    }

    const resolvedPlanPath = resolveExistingPlanPath(planPath, context);
    if (resolvedPlanPath === undefined) {
        context.ui.notify("Plannotator could not locate the active plan file.", "error");
        return;
    }

    const annotateCommand = commands.get("plannotator-annotate");
    if (annotateCommand === undefined) {
        context.ui.notify("Plannotator annotation command is unavailable.", "error");
        return;
    }

    try {
        const commandContext = toCommandContext(context);
        await annotateCommand.handler(JSON.stringify(resolvedPlanPath), commandContext);
    } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);
        context.ui.notify(`Failed to open the plan in Plannotator: ${message}`, "error");
    }
}
