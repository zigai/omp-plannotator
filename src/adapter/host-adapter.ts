import type {
    ExtensionAPI,
    ExtensionContext,
    ExtensionHandler,
    RegisteredCommand,
    ToolCallEvent,
    ToolCallEventResult,
} from "@oh-my-pi/pi-coding-agent";
import type { OmpPlannotatorHostAdapter } from "../types/index.ts";
import { extractOmpEditTargets } from "./patch-targets.ts";
import { resolveUserMessageOptions } from "./turn-resolver.ts";

type GenericEventHandler = (event: unknown, ctx: ExtensionContext) => unknown;
type GenericOnSignature = (event: string, handler: GenericEventHandler) => void;

export function createOmpPlannotatorHostAdapter(pi: ExtensionAPI): OmpPlannotatorHostAdapter {
    const commands = new Map<string, RegisteredCommand>();
    let currentContext: ExtensionContext | undefined;

    pi.on("session_start", (_event, ctx) => {
        currentContext = ctx;
    });

    pi.on("session_shutdown", (_event, ctx) => {
        if (currentContext === ctx) {
            currentContext = undefined;
        }
    });

    const registerCommandOverride: ExtensionAPI["registerCommand"] = (name, options) => {
        const commandEntry: RegisteredCommand = {
            name,
            handler: options.handler,
        };
        if (options.description !== undefined) {
            commandEntry.description = options.description;
        }
        if (options.getArgumentCompletions !== undefined) {
            commandEntry.getArgumentCompletions = options.getArgumentCompletions;
        }
        commands.set(name, commandEntry);
        // Keep upstream commands as private implementation details for the unified /plannotator router.
    };

    const sendUserMessageOverride: ExtensionAPI["sendUserMessage"] = (content, options) => {
        const resolvedOptions = resolveUserMessageOptions(options, currentContext);
        if (resolvedOptions === undefined) {
            pi.sendUserMessage(content);
            return;
        }
        pi.sendUserMessage(content, resolvedOptions);
    };

    // SAFETY: Intercepts tool_call to fan out multi-file edit operations across the wrapped handler.
    function asToolCallHandler(
        untypedHandler: unknown,
    ): ExtensionHandler<ToolCallEvent, ToolCallEventResult> {
        // SAFETY: Verified event name "tool_call" guarantees handler parameter matches ToolCallEvent.
        /* oxlint-disable-next-line typescript/no-unsafe-type-assertion */
        return untypedHandler as ExtensionHandler<ToolCallEvent, ToolCallEventResult>;
    }

    const onOverride = <E, R = undefined>(event: string, handler: ExtensionHandler<E, R>): void => {
        if (event === "tool_call") {
            const toolCallHandler = asToolCallHandler(handler);
            const wrappedHandler = async (
                toolEvent: ToolCallEvent,
                ctx: ExtensionContext,
            ): Promise<ToolCallEventResult | void> => {
                if (toolEvent.toolName === "edit") {
                    const targets = extractOmpEditTargets(toolEvent.input, ctx.cwd);
                    if (targets.length === 0) {
                        return toolCallHandler(toolEvent, ctx);
                    }
                    let lastResult: ToolCallEventResult | void = undefined;
                    for (const targetPath of targets) {
                        const clonedEvent: ToolCallEvent = {
                            ...toolEvent,
                            input: { ...toolEvent.input, path: targetPath },
                        };
                        const result = await toolCallHandler(clonedEvent, ctx);
                        if (result && typeof result === "object" && result.block === true) {
                            return result;
                        }
                        if (result !== undefined) {
                            lastResult = result;
                        }
                    }
                    return lastResult;
                }
                return toolCallHandler(toolEvent, ctx);
            };
            pi.on("tool_call", wrappedHandler);
            return;
        }

        // SAFETY: Forward non-tool_call events to host ExtensionAPI without mutation.
        /* oxlint-disable-next-line typescript/unbound-method, antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
        const typedOn = pi.on as unknown as GenericOnSignature;
        // SAFETY: Forward non-tool_call handler to host ExtensionAPI without mutation.
        /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
        const typedHandler = handler as unknown as GenericEventHandler;
        typedOn.call(pi, event, typedHandler);
    };

    const adaptedApi = new Proxy(pi, {
        get(target, prop, _receiver) {
            if (prop === "registerCommand") {
                return registerCommandOverride;
            }
            if (prop === "sendUserMessage") {
                return sendUserMessageOverride;
            }
            if (prop === "on") {
                return onOverride;
            }
            // SAFETY: Forward property access to the underlying ExtensionAPI instance.
            const value: unknown = Reflect.get(target, prop, target);
            if (typeof value === "function") {
                // SAFETY: Dynamic bind of underlying host ExtensionAPI method.
                /* oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-call, typescript/no-unsafe-member-access */
                return value.bind(target);
            }
            return value;
        },
    });

    return {
        api: adaptedApi,
        commands,
    };
}
