import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
    ExtensionAPI,
    ExtensionContext,
    KeyId,
    RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { getKeybindings } from "@oh-my-pi/pi-tui";
import { toCommandContext } from "../plan.ts";
import { dispatchCommand } from "./command-router.ts";
import { ANNO_DIFF_SHORTCUT, ANNO_LAST_SHORTCUT } from "./constants.ts";
export interface ParsedKeybindingsConfig {
    readonly [key: string]: readonly string[];
}

export type KeybindingValue = string | readonly string[];
export type KeybindingRecord = Record<string, KeybindingValue | undefined>;

export interface PlannotatorShortcutOptions {
    readonly userBindings?: KeybindingRecord;
    readonly cwd?: string;
}

const KEY_VALUE_PATTERN = /^([a-zA-Z0-9_.-]+)\s*:\s*(.*)$/;

function parseJsonBindings(trimmed: string): Record<string, string[]> | undefined {
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            const map: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === "string") {
                    map[k] = [v];
                } else if (Array.isArray(v)) {
                    map[k] = v.filter((item): item is string => typeof item === "string");
                }
            }
            return map;
        }
    } catch {
        // Fall through to YAML parsing
    }
    return undefined;
}

export function parseSimpleKeybindings(content: string): ParsedKeybindingsConfig {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
        const jsonResult = parseJsonBindings(trimmed);
        if (jsonResult !== undefined) {
            return jsonResult;
        }
    }

    const result: Record<string, string[]> = {};
    let currentKey: string | null = null;

    for (const rawLine of content.split("\n")) {
        const line = rawLine.replace(/#.*$/, "").trimEnd();
        if (line.trim() === "") {
            continue;
        }

        const kvMatch = KEY_VALUE_PATTERN.exec(line);
        if (kvMatch !== null) {
            const key = kvMatch[1]?.trim();
            const val = kvMatch[2]?.trim() ?? "";
            if (key === undefined || key === "") {
                continue;
            }

            if (val === "" || val === "[]") {
                result[key] = [];
                currentKey = key;
            } else if (val.startsWith("[") && val.endsWith("]")) {
                result[key] = val
                    .slice(1, -1)
                    .split(",")
                    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
                    .filter((s) => s.length > 0);
                currentKey = null;
            } else {
                result[key] = [val.replace(/^["']|["']$/g, "")];
                currentKey = null;
            }
        } else if (currentKey !== null && line.trim().startsWith("-")) {
            const item = line
                .trim()
                .slice(1)
                .trim()
                .replace(/^["']|["']$/g, "");
            const existing = result[currentKey];
            if (existing !== undefined) {
                existing.push(item);
            } else {
                result[currentKey] = [item];
            }
        }
    }

    return result;
}

function extractKeyId(value: KeybindingValue | undefined): KeyId | undefined | false {
    if (value === undefined) {
        return false;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return undefined;
        }
        const first: unknown = value[0];
        if (typeof first !== "string") {
            return undefined;
        }
        const trimmed = first.trim();
        if (trimmed === "none" || trimmed === "off" || trimmed === "") {
            return undefined;
        }
        // SAFETY: User-configured string from keybindings config is normalized to KeyId.
        /* oxlint-disable-next-line typescript/no-unsafe-type-assertion */
        return trimmed.toLowerCase() as KeyId;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "none" || trimmed === "off" || trimmed === "" || trimmed === "[]") {
            return undefined;
        }
        // SAFETY: User-configured string from keybindings config is normalized to KeyId.
        /* oxlint-disable-next-line typescript/no-unsafe-type-assertion */
        return trimmed.toLowerCase() as KeyId;
    }
    return false;
}
function findKeyInBindings(
    bindings: KeybindingRecord,
    actionNames: readonly string[],
): KeyId | undefined | false {
    for (const name of actionNames) {
        if (Object.prototype.hasOwnProperty.call(bindings, name)) {
            const extracted = extractKeyId(bindings[name]);
            if (extracted !== false) {
                return extracted;
            }
        }
    }
    return false;
}

function resolveDiskConfigPaths(cwd?: string): readonly string[] {
    const paths: string[] = [];

    if (cwd !== undefined && cwd.trim() !== "") {
        paths.push(
            join(cwd, ".omp", "keybindings.yml"),
            join(cwd, ".omp", "keybindings.yaml"),
            join(cwd, ".omp", "keybindings.json"),
        );
    }

    const home = homedir();
    const agentDir =
        process.env.OMP_AGENT_DIR ?? process.env.PI_AGENT_DIR ?? join(home, ".omp", "agent");
    paths.push(
        join(agentDir, "keybindings.yml"),
        join(agentDir, "keybindings.yaml"),
        join(agentDir, "keybindings.json"),
    );

    return paths;
}

export function resolveShortcutFromConfig(
    actionNames: readonly string[],
    defaultKey: KeyId,
    options?: PlannotatorShortcutOptions,
): KeyId | undefined {
    if (options?.userBindings !== undefined) {
        const result = findKeyInBindings(options.userBindings, actionNames);
        if (result !== false) {
            return result;
        }
    }

    try {
        const kb = getKeybindings();
        const userBindings = kb.getUserBindings();
        const result = findKeyInBindings(userBindings, actionNames);
        if (result !== false) {
            return result;
        }
    } catch {
        // TUI keybindings manager may be uninitialized in headless or test modes
    }

    const candidatePaths = resolveDiskConfigPaths(options?.cwd);
    for (const filePath of candidatePaths) {
        if (existsSync(filePath)) {
            try {
                const content = readFileSync(filePath, "utf-8");
                const parsed = parseSimpleKeybindings(content);
                const result = findKeyInBindings(parsed, actionNames);
                if (result !== false) {
                    return result;
                }
            } catch {
                // Ignore parse errors on individual candidate files and check next
            }
        }
    }

    return defaultKey;
}

async function executeShortcutCommand(
    commands: ReadonlyMap<string, RegisteredCommand>,
    subcommand: string,
    args: string,
    ctx: ExtensionContext,
): Promise<void> {
    if (typeof ctx.isIdle === "function" && !ctx.isIdle()) {
        return;
    }

    try {
        const cmdCtx = toCommandContext(ctx);
        await dispatchCommand(commands, subcommand, args, cmdCtx);
    } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);
        ctx.ui.notify(`Failed to launch Plannotator: ${message}`, "error");
    }
}

export function registerPlannotatorShortcuts(
    pi: ExtensionAPI,
    commands: ReadonlyMap<string, RegisteredCommand>,
    options?: PlannotatorShortcutOptions,
): void {
    const lastShortcut = resolveShortcutFromConfig(
        ["anno.last", "plannotator.last"],
        ANNO_LAST_SHORTCUT,
        options,
    );

    if (lastShortcut !== undefined) {
        pi.registerShortcut(lastShortcut, {
            description: "Annotate last assistant response in Plannotator",
            handler: async (ctx: ExtensionContext): Promise<void> => {
                await executeShortcutCommand(commands, "last", "", ctx);
            },
        });
    }

    const diffShortcut = resolveShortcutFromConfig(
        ["anno.diff", "plannotator.diff"],
        ANNO_DIFF_SHORTCUT,
        options,
    );

    if (diffShortcut !== undefined) {
        pi.registerShortcut(diffShortcut, {
            description: "Review working tree diff in Plannotator",
            handler: async (ctx: ExtensionContext): Promise<void> => {
                await executeShortcutCommand(commands, "review", "", ctx);
            },
        });
    }
}
