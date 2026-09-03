// SAFETY: Test harness intentionally provides structural fakes for ExtensionAPI.
/* oxlint-disable typescript/no-unsafe-type-assertion, antislop/no-chained-type-assertions */

import type {
    ExtensionAPI,
    ExtensionContext,
    ExtensionFlag,
    ExtensionHandler,
    ExtensionShortcut,
    KeyId,
    RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";

export interface RegisteredTool {
    readonly name: string;
    readonly description?: string;
}

export interface RecordedSendUserMessage {
    readonly content: unknown;
    readonly options: { readonly deliverAs?: "steer" | "followUp" } | undefined;
}

export interface RecordedCommandRegistration {
    readonly name: string;
    readonly options: {
        readonly description?: string;
        readonly getArgumentCompletions?: RegisteredCommand["getArgumentCompletions"];
        readonly handler: RegisteredCommand["handler"];
    };
}

export interface RecordingApiHarness {
    readonly api: ExtensionAPI;
    readonly commands: ReadonlyMap<string, RegisteredCommand>;
    readonly flags: ReadonlyMap<string, ExtensionFlag>;
    readonly shortcuts: ReadonlyMap<string, ExtensionShortcut>;
    readonly tools: ReadonlyMap<string, RegisteredTool>;
    readonly handlers: ReadonlyMap<string, readonly ExtensionHandler<unknown, unknown>[]>;
    readonly sentUserMessages: readonly RecordedSendUserMessage[];
    readonly registeredCommands: readonly RecordedCommandRegistration[];
    readonly appendedEntries: readonly { readonly customType: string; readonly data: unknown }[];
    emitEvent: <E, R = unknown>(
        event: string,
        payload: E,
        ctx: ExtensionContext,
    ) => Promise<R | void>;
}

export function createRecordingApiHarness(
    options: { readonly startInPlanMode?: boolean } = {},
): RecordingApiHarness {
    const commands = new Map<string, RegisteredCommand>();
    const flags = new Map<string, ExtensionFlag>();
    const shortcuts = new Map<string, ExtensionShortcut>();
    const tools = new Map<string, RegisteredTool>();
    const handlers = new Map<string, Array<ExtensionHandler<unknown, unknown>>>();
    const sentUserMessages: RecordedSendUserMessage[] = [];
    const registeredCommands: RecordedCommandRegistration[] = [];
    const appendedEntries: Array<{ readonly customType: string; readonly data: unknown }> = [];

    const api = {
        registerCommand(
            name: string,
            commandOptions: {
                readonly description?: string;
                readonly getArgumentCompletions?: RegisteredCommand["getArgumentCompletions"];
                readonly handler: RegisteredCommand["handler"];
            },
        ): void {
            const commandEntry: RegisteredCommand = {
                name,
                handler: commandOptions.handler,
            };
            if (commandOptions.description !== undefined) {
                commandEntry.description = commandOptions.description;
            }
            if (commandOptions.getArgumentCompletions !== undefined) {
                commandEntry.getArgumentCompletions = commandOptions.getArgumentCompletions;
            }
            commands.set(name, commandEntry);
            registeredCommands.push({ name, options: commandOptions });
        },
        registerFlag(name: string, flagOptions: ExtensionFlag): void {
            flags.set(name, flagOptions);
        },
        registerShortcut(shortcut: KeyId, shortcutOptions: ExtensionShortcut): void {
            shortcuts.set(shortcut, shortcutOptions);
        },
        registerTool(definition: RegisteredTool): void {
            tools.set(definition.name, definition);
        },
        registerMessageRenderer: () => {},
        registerAssistantThinkingRenderer: () => {},
        getFlag: (name: string) =>
            name === "plan" && options.startInPlanMode === true ? true : flags.get(name)?.default,
        getCommands: () => Array.from(commands.values()),
        getActiveTools: () => ["read", "edit", "write", "bash", "grep", "glob"],
        setActiveTools: () => {},
        getThinkingLevel: () => "medium",
        setThinkingLevel: () => {},
        setModel: () => {},
        appendEntry(customType: string, data: unknown): void {
            appendedEntries.push({ customType, data });
        },
        on(event: string, handler: ExtensionHandler<unknown, unknown>): void {
            const list = handlers.get(event) ?? [];
            list.push(handler);
            handlers.set(event, list);
        },
        events: {
            on: () => {},
            emit: () => {},
        },
        sendUserMessage(
            content: unknown,
            messageOptions?: { readonly deliverAs?: "steer" | "followUp" },
        ): void {
            sentUserMessages.push({ content, options: messageOptions });
        },
    };

    async function emitEvent<E, R = unknown>(
        event: string,
        payload: E,
        ctx: ExtensionContext,
    ): Promise<R | void> {
        const list = handlers.get(event) ?? [];
        let lastResult: R | void = undefined;
        for (const handler of list) {
            // SAFETY: Event handler return value conforms to expected test return type R.
            /* oxlint-disable-next-line typescript/no-unsafe-type-assertion */
            const result = (await handler(payload, ctx)) as R | void;
            if (result !== undefined) {
                lastResult = result;
            }
        }
        return lastResult;
    }

    return {
        // SAFETY: Complete structural ExtensionAPI fake for tests.
        api: api as unknown as ExtensionAPI,
        commands,
        flags,
        shortcuts,
        tools,
        handlers,
        sentUserMessages,
        registeredCommands,
        appendedEntries,
        emitEvent,
    };
}
