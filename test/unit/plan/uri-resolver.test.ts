import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveExistingPlanPath, resolveLocalPath } from "../../../src/plan/uri-resolver.ts";
import { createTestExtensionContext } from "../../harness/extension-ctx.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const dir of temporaryDirectories.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe("resolveLocalPath", () => {
    it("resolves valid local path within artifacts directory", () => {
        const artifactsDir = mkdtempSync(join(tmpdir(), "omp-test-artifacts-"));
        temporaryDirectories.push(artifactsDir);

        const { context } = createTestExtensionContext({
            localProtocolOptions: {
                getArtifactsDir: () => artifactsDir,
                getSessionId: () => "sess-1",
            },
        });

        const resolved = resolveLocalPath("local://PLAN.md", context);
        expect(resolved).toBe(join(artifactsDir, "local", "PLAN.md"));
    });

    it("rejects path traversal attempts with ..", () => {
        const artifactsDir = mkdtempSync(join(tmpdir(), "omp-test-artifacts-"));
        temporaryDirectories.push(artifactsDir);

        const { context } = createTestExtensionContext({
            localProtocolOptions: {
                getArtifactsDir: () => artifactsDir,
            },
        });

        expect(resolveLocalPath("local://../secret.txt", context)).toBeUndefined();
        expect(resolveLocalPath("local://nested/../../secret.txt", context)).toBeUndefined();
    });

    it("rejects absolute paths inside local URI", () => {
        const { context } = createTestExtensionContext();
        expect(resolveLocalPath("local:///etc/passwd", context)).toBeUndefined();
    });
});

describe("resolveExistingPlanPath", () => {
    it("returns candidate path when on-disk file exists", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
        temporaryDirectories.push(tempDir);

        const planFile = join(tempDir, "custom-plan.md");
        writeFileSync(planFile, "# Custom Plan");

        const { context } = createTestExtensionContext({ cwd: tempDir });
        const resolved = resolveExistingPlanPath("custom-plan.md", context);

        expect(resolved).toBe(planFile);
    });

    it("falls back to default local://PLAN.md when candidate is undefined and default exists", () => {
        const artifactsDir = mkdtempSync(join(tmpdir(), "omp-test-artifacts-"));
        temporaryDirectories.push(artifactsDir);
        const localDir = join(artifactsDir, "local");
        mkdirSync(localDir, { recursive: true });
        const defaultPlanFile = join(localDir, "PLAN.md");
        writeFileSync(defaultPlanFile, "# Default Plan");

        const { context } = createTestExtensionContext({
            localProtocolOptions: {
                getArtifactsDir: () => artifactsDir,
            },
        });

        const resolved = resolveExistingPlanPath(undefined, context);
        expect(resolved).toBe(defaultPlanFile);
    });

    it("returns undefined when neither candidate nor default file exists on disk", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omp-test-empty-"));
        temporaryDirectories.push(tempDir);

        const { context } = createTestExtensionContext({ cwd: tempDir });
        const resolved = resolveExistingPlanPath("nonexistent-plan.md", context);

        expect(resolved).toBeUndefined();
    });
});
