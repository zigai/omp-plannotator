import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type {
    ExtensionCommandContext,
    ExtensionContext,
    RegisteredCommand,
    ToolCallEvent,
} from "@oh-my-pi/pi-coding-agent";

export const DEFAULT_PLAN_PATH = "local://PLAN.md";

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

    const base = basename(path).toLowerCase();
    if (base === "plan.md" || base.endsWith("-plan.md") || base.endsWith("_plan.md")) {
        return path;
    }
    return undefined;
}

export function resolveLocalPath(path: string, context: ExtensionContext): string | undefined {
    const options = context.localProtocolOptions;
    const artifactsDir = options?.getArtifactsDir?.();
    const rawSessionId =
        options?.getSessionId?.() ?? context.sessionManager.getSessionId() ?? "session";
    const sessionId = rawSessionId.replace(/[^a-zA-Z0-9_.-]/gu, "_") || "session";
    const localRoot =
        artifactsDir === null || artifactsDir === undefined
            ? join(tmpdir(), "omp-local", sessionId)
            : resolve(artifactsDir, "local");
    let decodedPath: string;
    try {
        const url = new URL(path);
        if (url.protocol !== "local:") return undefined;
        if (url.host === "" && url.pathname.startsWith("/")) return undefined;
        if (path.includes("..")) return undefined;
        const rawPath = url.host ? `${url.host}${url.pathname}` : url.pathname.replace(/^\/+/u, "");
        decodedPath = decodeURIComponent(rawPath);
    } catch {
        return undefined;
    }
    if (
        decodedPath.length === 0 ||
        decodedPath.startsWith("/") ||
        isAbsolute(decodedPath) ||
        decodedPath.split("/").includes("..")
    ) {
        return undefined;
    }

    const resolvedPath = resolve(localRoot, decodedPath);
    const relativePath = relative(localRoot, resolvedPath);
    if (
        relativePath === ".." ||
        relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    ) {
        return undefined;
    }
    return resolvedPath;
}

export function resolveExistingPlanPath(
    planPath: string | undefined,
    context: ExtensionContext,
): string | undefined {
    const candidates: string[] = [];
    if (planPath !== undefined) {
        candidates.push(planPath);
    }
    if (!candidates.includes(DEFAULT_PLAN_PATH)) {
        candidates.push(DEFAULT_PLAN_PATH);
    }

    for (const candidate of candidates) {
        const resolvedPath = candidate.startsWith("local:")
            ? resolveLocalPath(candidate, context)
            : resolve(context.cwd, candidate);
        if (resolvedPath !== undefined && existsSync(resolvedPath)) {
            return resolvedPath;
        }
    }
    return undefined;
}

function toCommandContext(context: ExtensionContext): ExtensionCommandContext {
    const commandDefaults = {
        getContextUsage: () => undefined,
        waitForIdle: async (): Promise<void> => {},
        newSession: async (): Promise<{ cancelled: boolean }> => ({ cancelled: false }),
        branch: async (): Promise<{ cancelled: boolean }> => ({ cancelled: false }),
        switchSession: async (): Promise<{ cancelled: boolean }> => ({ cancelled: false }),
        reload: async (): Promise<void> => {},
        navigateTree: async (): Promise<{ cancelled: boolean }> => ({ cancelled: false }),
    };
    // SAFETY: Prototype delegation preserves all host ExtensionContext properties while defaulting missing command methods.
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion */
    return Object.assign(Object.create(context), commandDefaults) as ExtensionCommandContext;
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
