import type {
    ExtensionAPI,
    ExtensionCommandContext,
    ExtensionContext,
    RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { createPlannotatorGhostTextProvider } from "./autocomplete.ts";
import {
    ANNO_COMMAND_NAME,
    PLANNOTATOR_COMMAND_NAME,
    REQUIRED_UPSTREAM_COMMANDS,
} from "./constants.ts";

async function dispatchCommand(
    commands: ReadonlyMap<string, RegisteredCommand>,
    name: string,
    args: string,
    ctx: ExtensionCommandContext,
): Promise<void> {
    const command = commands.get(`plannotator-${name}`);
    if (command === undefined) {
        ctx.ui.notify(`Plannotator ${name} command not available`, "error");
        return;
    }
    await command.handler(args, ctx);
}

export function registerPlannotatorCommand(
    pi: ExtensionAPI,
    commands: ReadonlyMap<string, RegisteredCommand>,
): void {
    for (const requiredName of REQUIRED_UPSTREAM_COMMANDS) {
        if (!commands.has(requiredName)) {
            throw new Error(
                `Required upstream command "${requiredName}" was not registered by Plannotator.`,
            );
        }
    }

    const commandDefinition = {
        description: "Plannotator annotation and code review commands",
        async handler(args: string, ctx: ExtensionCommandContext): Promise<void> {
            const trimmed = args.trim();

            const firstToken = trimmed.split(/\s+/)[0] ?? "";
            const remainder = trimmed.slice(firstToken.length).trimStart();

            if (trimmed.length === 0 || firstToken === "last") {
                await dispatchCommand(commands, "last", "", ctx);
                return;
            }

            if (firstToken === "diff" || firstToken === "review") {
                await dispatchCommand(commands, "review", remainder, ctx);
                return;
            }

            if (
                firstToken.startsWith("--git") ||
                firstToken.startsWith("--gitbutler") ||
                /^https?:\/\/.*\/pull\/\d+/i.test(firstToken) ||
                /^https?:\/\/.*\/merge_requests\/\d+/i.test(firstToken)
            ) {
                await dispatchCommand(commands, "review", trimmed, ctx);
                return;
            }

            await dispatchCommand(commands, "annotate", trimmed, ctx);
        },
    };

    pi.registerCommand(ANNO_COMMAND_NAME, commandDefinition);
    pi.registerCommand(PLANNOTATOR_COMMAND_NAME, commandDefinition);
    const registerAutocomplete = (context: ExtensionContext): void => {
        if (context.hasUI && typeof context.ui.addAutocompleteProvider === "function") {
            context.ui.addAutocompleteProvider(createPlannotatorGhostTextProvider);
        }
    };

    pi.on("session_start", (_event, context) => {
        registerAutocomplete(context);
        if (typeof context.setTimeout === "function") {
            context.setTimeout(() => {
                registerAutocomplete(context);
            }, 50);
        }
    });
}
