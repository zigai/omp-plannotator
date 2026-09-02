import type {
    ExtensionAPI,
    ExtensionCommandContext,
    RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { createPlannotatorGhostTextProvider } from "./autocomplete.ts";
import {
    ANNO_COMMAND_NAME,
    PLANNOTATOR_COMMAND_NAME,
    REQUIRED_UPSTREAM_COMMANDS,
} from "./constants.ts";

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
                const lastCommand = commands.get("plannotator-last");
                if (lastCommand === undefined) {
                    ctx.ui.notify("Plannotator last command not available", "error");
                    return;
                }
                await lastCommand.handler("", ctx);
                return;
            }

            if (firstToken === "diff" || firstToken === "review") {
                const reviewCommand = commands.get("plannotator-review");
                if (reviewCommand === undefined) {
                    ctx.ui.notify("Plannotator review command not available", "error");
                    return;
                }
                await reviewCommand.handler(remainder, ctx);
                return;
            }

            if (
                firstToken.startsWith("--git") ||
                firstToken.startsWith("--gitbutler") ||
                /^https?:\/\/.*\/pull\/\d+/i.test(firstToken) ||
                /^https?:\/\/.*\/merge_requests\/\d+/i.test(firstToken)
            ) {
                const reviewCommand = commands.get("plannotator-review");
                if (reviewCommand === undefined) {
                    ctx.ui.notify("Plannotator review command not available", "error");
                    return;
                }
                await reviewCommand.handler(trimmed, ctx);
                return;
            }

            const annotateCommand = commands.get("plannotator-annotate");
            if (annotateCommand === undefined) {
                ctx.ui.notify("Plannotator annotate command not available", "error");
                return;
            }

            await annotateCommand.handler(trimmed, ctx);
        },
    };

    pi.registerCommand(ANNO_COMMAND_NAME, commandDefinition);
    pi.registerCommand(PLANNOTATOR_COMMAND_NAME, commandDefinition);

    if (typeof pi.on === "function") {
        pi.on("session_start", (_event, context) => {
            if (context.hasUI && typeof context.ui.addAutocompleteProvider === "function") {
                context.ui.addAutocompleteProvider(createPlannotatorGhostTextProvider);
            }
        });
    }
}
