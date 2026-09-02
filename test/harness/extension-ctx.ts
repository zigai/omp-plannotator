// SAFETY: Test harness intentionally provides structural fakes for ExtensionContext.
/* oxlint-disable typescript/no-unsafe-type-assertion, antislop/no-chained-type-assertions */

import type { ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { vi } from "vitest";

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
            custom: vi.fn().mockResolvedValue(undefined),
            setStatus: vi.fn(),
            setWidget: vi.fn(),
            setHeader: vi.fn(),
            setFooter: vi.fn(),
            addAutocompleteProvider: vi.fn(),
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
        setActiveTools: vi.fn(),
        setSessionName: vi.fn(),
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
