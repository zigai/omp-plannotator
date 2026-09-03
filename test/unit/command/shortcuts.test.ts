import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext, RegisteredCommand } from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { ANNO_DIFF_SHORTCUT, ANNO_LAST_SHORTCUT } from "../../../src/command/constants.ts";
import {
    parseSimpleKeybindings,
    registerPlannotatorShortcuts,
    resolveShortcutFromConfig,
} from "../../../src/command/shortcuts.ts";
import { createRecordingApiHarness } from "../../harness/extension-api.ts";
import { createTestExtensionContext } from "../../harness/extension-ctx.ts";

type RecordedCall = {
    readonly args: string;
    readonly ctx: ExtensionCommandContext;
};

interface RecordingCommand {
    readonly command: RegisteredCommand;
    readonly calls: RecordedCall[];
}

function createRecordingCommand(name: string): RecordingCommand {
    const calls: RecordedCall[] = [];
    return {
        calls,
        command: {
            name,
            handler: async (args, ctx) => {
                calls.push({ args, ctx });
            },
        },
    };
}

describe("parseSimpleKeybindings", () => {
    it("parses single key-value mappings", () => {
        const yaml = `
# Comment
anno.last: ctrl+alt+a
anno.diff: alt+shift+d
`;
        const result = parseSimpleKeybindings(yaml);
        expect(result["anno.last"]).toEqual(["ctrl+alt+a"]);
        expect(result["anno.diff"]).toEqual(["alt+shift+d"]);
    });

    it("parses multi-line list mappings", () => {
        const yaml = `
anno.last:
  - ctrl+alt+a
  - ctrl+shift+a
`;
        const result = parseSimpleKeybindings(yaml);
        expect(result["anno.last"]).toEqual(["ctrl+alt+a", "ctrl+shift+a"]);
    });

    it("parses empty lists and inline lists", () => {
        const yaml = `
anno.disabled: []
anno.inline: [ctrl+1, ctrl+2]
`;
        const result = parseSimpleKeybindings(yaml);
        expect(result["anno.disabled"]).toEqual([]);
        expect(result["anno.inline"]).toEqual(["ctrl+1", "ctrl+2"]);
    });

    it("parses JSON formatted keybindings", () => {
        const json = JSON.stringify({
            "anno.last": "ctrl+alt+a",
            "anno.diff": ["alt+shift+d"],
        });
        const result = parseSimpleKeybindings(json);
        expect(result["anno.last"]).toEqual(["ctrl+alt+a"]);
        expect(result["anno.diff"]).toEqual(["alt+shift+d"]);
    });
});

describe("resolveShortcutFromConfig", () => {
    it("returns default key when no config is specified", () => {
        expect(resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT)).toBe(
            ANNO_LAST_SHORTCUT,
        );
    });

    it("resolves from userBindings option when specified as string", () => {
        expect(
            resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT, {
                userBindings: { "anno.last": "ctrl+alt+x" },
            }),
        ).toBe("ctrl+alt+x");
    });

    it("resolves from userBindings option when specified as array", () => {
        expect(
            resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT, {
                userBindings: { "anno.last": ["ctrl+alt+y", "alt+y"] },
            }),
        ).toBe("ctrl+alt+y");
    });

    it("returns undefined when disabled via empty list in userBindings", () => {
        expect(
            resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT, {
                userBindings: { "anno.last": [] },
            }),
        ).toBeUndefined();
    });

    it("returns undefined when disabled via none or off in userBindings", () => {
        expect(
            resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT, {
                userBindings: { "anno.last": "none" },
            }),
        ).toBeUndefined();
        expect(
            resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT, {
                userBindings: { "anno.last": "off" },
            }),
        ).toBeUndefined();
    });

    it("checks alias names in order", () => {
        expect(
            resolveShortcutFromConfig(["anno.last", "plannotator.last"], ANNO_LAST_SHORTCUT, {
                userBindings: { "plannotator.last": "ctrl+alt+z" },
            }),
        ).toBe("ctrl+alt+z");
    });

    it("resolves from disk config file in cwd", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-keybindings-test-"));
        try {
            const ompDir = join(tempDir, ".omp");
            const configPath = join(ompDir, "keybindings.yml");
            mkdirSync(ompDir, { recursive: true });
            writeFileSync(configPath, "anno.last: ctrl+shift+d\n", "utf-8");

            const resolved = resolveShortcutFromConfig(["anno.last"], ANNO_LAST_SHORTCUT, {
                cwd: tempDir,
            });
            expect(resolved).toBe("ctrl+shift+d");
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

describe("registerPlannotatorShortcuts", () => {
    it("registers alt+shift+a and alt+shift+d shortcuts with descriptions", () => {
        const harness = createRecordingApiHarness();
        const commands = new Map<string, RegisteredCommand>();
        registerPlannotatorShortcuts(harness.api, commands);

        expect(harness.shortcuts.size).toBe(2);

        const lastShortcut = harness.shortcuts.get(ANNO_LAST_SHORTCUT);
        expect(lastShortcut).toBeDefined();
        expect(lastShortcut?.description).toBe("Annotate last assistant response in Plannotator");

        const diffShortcut = harness.shortcuts.get(ANNO_DIFF_SHORTCUT);
        expect(diffShortcut).toBeDefined();
        expect(diffShortcut?.description).toBe("Review working tree diff in Plannotator");
    });

    it("honors custom keys specified in userBindings", () => {
        const harness = createRecordingApiHarness();
        const commands = new Map<string, RegisteredCommand>();
        registerPlannotatorShortcuts(harness.api, commands, {
            userBindings: {
                "anno.last": "ctrl+alt+a",
                "anno.diff": "ctrl+alt+d",
            },
        });

        expect(harness.shortcuts.has("ctrl+alt+a")).toBe(true);
        expect(harness.shortcuts.has("ctrl+alt+d")).toBe(true);
        expect(harness.shortcuts.has(ANNO_LAST_SHORTCUT)).toBe(false);
        expect(harness.shortcuts.has(ANNO_DIFF_SHORTCUT)).toBe(false);
    });

    it("does not register shortcut when disabled via empty list", () => {
        const harness = createRecordingApiHarness();
        const commands = new Map<string, RegisteredCommand>();
        registerPlannotatorShortcuts(harness.api, commands, {
            userBindings: {
                "anno.last": [],
            },
        });

        expect(harness.shortcuts.has(ANNO_LAST_SHORTCUT)).toBe(false);
        expect(harness.shortcuts.has(ANNO_DIFF_SHORTCUT)).toBe(true);
    });

    it("ignores alt+shift+a invocation when agent is not idle", async () => {
        const harness = createRecordingApiHarness();
        const last = createRecordingCommand("plannotator-last");
        const commands = new Map<string, RegisteredCommand>([["plannotator-last", last.command]]);
        registerPlannotatorShortcuts(harness.api, commands);

        const shortcut = harness.shortcuts.get(ANNO_LAST_SHORTCUT);
        expect(shortcut).toBeDefined();

        const { context } = createTestExtensionContext({ idle: false });
        await shortcut?.handler(context);

        expect(last.calls).toHaveLength(0);
    });

    it("dispatches last command via alt+shift+a when agent is idle", async () => {
        const harness = createRecordingApiHarness();
        const last = createRecordingCommand("plannotator-last");
        const commands = new Map<string, RegisteredCommand>([["plannotator-last", last.command]]);
        registerPlannotatorShortcuts(harness.api, commands);

        const shortcut = harness.shortcuts.get(ANNO_LAST_SHORTCUT);
        expect(shortcut).toBeDefined();

        const { context } = createTestExtensionContext({ idle: true });
        await shortcut?.handler(context);

        expect(last.calls).toHaveLength(1);
        expect(last.calls[0]?.args).toBe("");
        expect(last.calls[0]?.ctx).toBeDefined();
    });

    it("ignores alt+shift+d invocation when agent is not idle", async () => {
        const harness = createRecordingApiHarness();
        const review = createRecordingCommand("plannotator-review");
        const commands = new Map<string, RegisteredCommand>([
            ["plannotator-review", review.command],
        ]);
        registerPlannotatorShortcuts(harness.api, commands);

        const shortcut = harness.shortcuts.get(ANNO_DIFF_SHORTCUT);
        expect(shortcut).toBeDefined();

        const { context } = createTestExtensionContext({ idle: false });
        await shortcut?.handler(context);

        expect(review.calls).toHaveLength(0);
    });

    it("dispatches review command with empty args via alt+shift+d when agent is idle", async () => {
        const harness = createRecordingApiHarness();
        const review = createRecordingCommand("plannotator-review");
        const commands = new Map<string, RegisteredCommand>([
            ["plannotator-review", review.command],
        ]);
        registerPlannotatorShortcuts(harness.api, commands);

        const shortcut = harness.shortcuts.get(ANNO_DIFF_SHORTCUT);
        expect(shortcut).toBeDefined();

        const { context } = createTestExtensionContext({ idle: true });
        await shortcut?.handler(context);

        expect(review.calls).toHaveLength(1);
        expect(review.calls[0]?.args).toBe("");
        expect(review.calls[0]?.ctx).toBeDefined();
    });

    it("notifies user when target command is missing", async () => {
        const harness = createRecordingApiHarness();
        const commands = new Map<string, RegisteredCommand>();
        registerPlannotatorShortcuts(harness.api, commands);

        const shortcut = harness.shortcuts.get(ANNO_DIFF_SHORTCUT);
        const { context, notifications } = createTestExtensionContext({ idle: true });
        await shortcut?.handler(context);

        expect(notifications).toEqual([
            {
                message: "Plannotator review command not available",
                type: "error",
            },
        ]);
    });

    it("notifies user when command handler throws", async () => {
        const harness = createRecordingApiHarness();
        const throwingCommand: RegisteredCommand = {
            name: "plannotator-last",
            handler: async () => {
                throw new Error("Browser launch failed");
            },
        };
        const commands = new Map<string, RegisteredCommand>([
            ["plannotator-last", throwingCommand],
        ]);
        registerPlannotatorShortcuts(harness.api, commands);

        const shortcut = harness.shortcuts.get(ANNO_LAST_SHORTCUT);
        const { context, notifications } = createTestExtensionContext({ idle: true });
        await shortcut?.handler(context);

        expect(notifications).toEqual([
            {
                message: "Failed to launch Plannotator: Browser launch failed",
                type: "error",
            },
        ]);
    });
});
