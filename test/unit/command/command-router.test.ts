import type {
    ExtensionCommandContext,
    ExtensionContext,
    RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { createPlannotatorGhostTextProvider } from "../../../src/command/autocomplete.ts";
import { registerPlannotatorCommand } from "../../../src/command/command-router.ts";
import { ANNO_COMMAND_NAME, PLANNOTATOR_COMMAND_NAME } from "../../../src/command/constants.ts";
import { createRecordingApiHarness } from "../../harness/extension-api.ts";
import { createTestCommandContext } from "../../harness/extension-ctx.ts";

type RecordedCall = {
    readonly args: string;
    readonly ctx: ExtensionCommandContext;
};

type RecordingCommand = {
    readonly command: RegisteredCommand;
    readonly calls: RecordedCall[];
};

function createRecordingCommand(name: string): RecordingCommand {
    const calls: RecordedCall[] = [];
    return {
        command: {
            name,
            description: `Description for ${name}`,
            async handler(args: string, ctx: ExtensionCommandContext): Promise<void> {
                calls.push({ args, ctx });
            },
        },
        calls,
    };
}

function createCapturedCommands() {
    const review = createRecordingCommand("plannotator-review");
    const annotate = createRecordingCommand("plannotator-annotate");
    const last = createRecordingCommand("plannotator-last");
    const commands = new Map<string, RegisteredCommand>([
        [review.command.name, review.command],
        [annotate.command.name, annotate.command],
        [last.command.name, last.command],
    ]);

    return { commands, review, annotate, last };
}

function getRequiredCommand(
    harness: { readonly commands: ReadonlyMap<string, RegisteredCommand> },
    name: string,
): RegisteredCommand {
    const command = harness.commands.get(name);
    if (command === undefined) {
        throw new Error(`Expected command "${name}" to be registered`);
    }
    return command;
}
describe("registerPlannotatorCommand - registration", () => {
    it("throws if an upstream command required by smart dispatch is missing", () => {
        const harness = createRecordingApiHarness();
        const incompleteCommands = new Map<string, RegisteredCommand>([
            ["plannotator-review", createRecordingCommand("plannotator-review").command],
        ]);

        expect(() => {
            registerPlannotatorCommand(harness.api, incompleteCommands);
        }).toThrow(
            'Required upstream command "plannotator-annotate" was not registered by Plannotator.',
        );
    });

    it("registers both /anno and /plannotator with their smart-target description", () => {
        const harness = createRecordingApiHarness();
        const { commands } = createCapturedCommands();

        registerPlannotatorCommand(harness.api, commands);

        const annoCommand = harness.commands.get(ANNO_COMMAND_NAME);
        const plannotatorCommand = harness.commands.get(PLANNOTATOR_COMMAND_NAME);

        expect(annoCommand?.description).toBe("Plannotator annotation and code review commands");
        expect(annoCommand?.getArgumentCompletions).toBeUndefined();
        expect(plannotatorCommand?.description).toBe(
            "Plannotator annotation and code review commands",
        );
        expect(plannotatorCommand?.getArgumentCompletions).toBeUndefined();
    });
});

describe("registerPlannotatorCommand - dispatch", () => {
    it("annotates the last assistant response when no target is supplied", async () => {
        const harness = createRecordingApiHarness();
        const captured = createCapturedCommands();
        registerPlannotatorCommand(harness.api, captured.commands);
        const command = getRequiredCommand(harness, ANNO_COMMAND_NAME);
        const ctx = createTestCommandContext();
        await command.handler("   ", ctx);

        expect(captured.last.calls).toEqual([{ args: "", ctx }]);
        expect(captured.annotate.calls).toHaveLength(0);
        expect(captured.review.calls).toHaveLength(0);
    });

    it("routes explicit 'last' target to annotate the last assistant response", async () => {
        const harness = createRecordingApiHarness();
        const captured = createCapturedCommands();
        registerPlannotatorCommand(harness.api, captured.commands);
        const command = getRequiredCommand(harness, ANNO_COMMAND_NAME);
        const ctx = createTestCommandContext();
        await command.handler("last", ctx);

        expect(captured.last.calls).toEqual([{ args: "", ctx }]);
        expect(captured.annotate.calls).toHaveLength(0);
        expect(captured.review.calls).toHaveLength(0);
    });

    it.each([
        ["README.md", "README.md"],
        ["plans/my cool plan.md", "plans/my cool plan.md"],
        [".", "."],
        ["plan", "plan"],
        ["plan-mode", "plan-mode"],
    ])("routes the annotation target %s to file/folder annotation", async (input, expected) => {
        const harness = createRecordingApiHarness();
        const captured = createCapturedCommands();
        registerPlannotatorCommand(harness.api, captured.commands);
        const command = getRequiredCommand(harness, ANNO_COMMAND_NAME);
        const ctx = createTestCommandContext();
        await command.handler(input, ctx);

        expect(captured.annotate.calls).toEqual([{ args: expected, ctx }]);
        expect(captured.last.calls).toHaveLength(0);
        expect(captured.review.calls).toHaveLength(0);
    });

    it.each([
        ["diff", ""],
        ["diff --git --staged", "--git --staged"],
        ["review", ""],
        ["review https://github.com/org/repo/pull/42", "https://github.com/org/repo/pull/42"],
        ["--git --staged", "--git --staged"],
        ["--gitbutler", "--gitbutler"],
        ["https://github.com/org/repo/pull/42", "https://github.com/org/repo/pull/42"],
        [
            "https://gitlab.com/org/repo/merge_requests/42",
            "https://gitlab.com/org/repo/merge_requests/42",
        ],
    ])("routes the review target %s to code review", async (input, expected) => {
        const harness = createRecordingApiHarness();
        const captured = createCapturedCommands();
        registerPlannotatorCommand(harness.api, captured.commands);
        const command = getRequiredCommand(harness, ANNO_COMMAND_NAME);
        const ctx = createTestCommandContext();
        await command.handler(input, ctx);

        expect(captured.review.calls).toEqual([{ args: expected, ctx }]);
        expect(captured.annotate.calls).toHaveLength(0);
        expect(captured.last.calls).toHaveLength(0);
    });

    it("registers ghost text provider on session_start when UI is present exactly once", async () => {
        const harness = createRecordingApiHarness();
        const captured = createCapturedCommands();
        registerPlannotatorCommand(harness.api, captured.commands);

        let registeredCount = 0;
        let registeredProviderFactory: unknown = undefined;
        const fakeContext = {
            hasUI: true,
            ui: {
                addAutocompleteProvider(factory: unknown) {
                    registeredCount += 1;
                    registeredProviderFactory = factory;
                },
            },
        };

        // SAFETY: Structural fake for ExtensionContext in session_start event test.
        /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
        await harness.emitEvent("session_start", {}, fakeContext as unknown as ExtensionContext);
        expect(registeredCount).toBe(1);
        expect(registeredProviderFactory).toBe(createPlannotatorGhostTextProvider);
    });
});
