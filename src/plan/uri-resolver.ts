import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export const DEFAULT_PLAN_PATH = "local://PLAN.md";

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
        decodedPath = decodeURIComponent(path.replace(/^local:\/{2}/, "").replaceAll("\\", "/"));
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
