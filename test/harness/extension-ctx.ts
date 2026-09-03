// SAFETY: Test harness intentionally provides structural fakes for ExtensionContext.
/* oxlint-disable typescript/no-unsafe-type-assertion, antislop/no-chained-type-assertions */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export interface RecordedNotification {
    readonly message: string;
    readonly type: string;
}

export interface TestExtensionContextFixture {
    readonly context: ExtensionContext;
    readonly notifications: readonly RecordedNotification[];
}

export function createTestExtensionContext(
    options: {
        readonly idle?: boolean;
        readonly cwd?: string;
        readonly hasUI?: boolean;
        readonly localProtocolOptions?: {
            readonly getArtifactsDir?: () => string | undefined;
            readonly getSessionId?: () => string | undefined;
        };
        readonly omitSessionManager?: boolean;
    } = {},
): TestExtensionContextFixture {
    const notifications: RecordedNotification[] = [];
    const isIdleState = options.idle ?? true;
    const workingDir = options.cwd ?? "/workspace";
    const hasUI = options.hasUI ?? true;

    const ctx = {
        cwd: workingDir,
        hasUI,
        isIdle: () => isIdleState,
        localProtocolOptions: options.localProtocolOptions,
        ui: {
            notify: (message: string, type = "info") => {
                notifications.push({ message, type });
            },
            custom: async () => undefined,
            setStatus: () => {},
            setWidget: () => {},
            setHeader: () => {},
            setFooter: () => {},
            addAutocompleteProvider: () => {},
            theme: {
                fg: (_color: string, text: string) => text,
                bg: (_color: string, text: string) => text,
            },
        },
        sessionManager:
            options.omitSessionManager === true
                ? undefined
                : {
                      getBranch: () => [],
                      getLeafId: () => "leaf-1",
                      getSessionId: () => "session-123",
                      getSessionName: () => undefined,
                      getSessionFile: () => "/workspace/.session.jsonl",
                  },
        setActiveTools: () => {},
        setSessionName: () => {},
    };

    return {
        // SAFETY: Structural fake for ExtensionContext.
        context: ctx as unknown as ExtensionContext,
        notifications,
    };
}

export function createTestCommandContext(
    options: { readonly notify?: (message: string, type?: string) => void } = {},
): ExtensionCommandContext {
    const ctx = {
        ui: {
            notify: options.notify ?? (() => {}),
        },
    };

    // SAFETY: Structural fake for ExtensionCommandContext.
    return ctx as unknown as ExtensionCommandContext;
}

export interface TempPlanFixture {
    readonly tempDir: string;
    readonly planFile: string;
    readonly cleanup: () => void;
}

export function createTempPlanFixture(name = "plan.md", content = "# Plan"): TempPlanFixture {
    const tempDir = mkdtempSync(join(tmpdir(), "omp-test-plan-"));
    const planFile = join(tempDir, name);
    writeFileSync(planFile, content);
    const cleanup = () => {
        rmSync(tempDir, { recursive: true, force: true });
    };
    return { tempDir, planFile, cleanup };
}
