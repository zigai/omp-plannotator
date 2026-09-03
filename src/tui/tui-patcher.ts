import type { ExtensionAPI, ExtensionContext, RegisteredCommand } from "@oh-my-pi/pi-coding-agent";
import type { TUI } from "@oh-my-pi/pi-tui";
import { openPlanInPlannotator, planPathFromToolCall } from "../plan.ts";
import { type PatchableTui, TUI_PATCH_STATE, type TuiPatchState } from "../types/index.ts";
import { analyzePlanReviewLayout } from "./layout-analyzer.ts";
import { PlannotatorPlanReviewOverlay } from "./overlay.ts";

export function patchPlanReviewOverlays(tui: TUI, openPlan: () => void): () => void {
    // SAFETY: The symbol-indexed patch state is owned exclusively by this module.
    const patchableTui = tui as PatchableTui;
    const existing = patchableTui[TUI_PATCH_STATE];
    if (existing !== undefined) {
        existing.openPlan = openPlan;
        return () => {};
    }

    // SAFETY: The method is rebound explicitly below before every invocation.
    /* oxlint-disable-next-line typescript/unbound-method */
    const originalShowOverlay = tui.showOverlay;
    const state: TuiPatchState = {
        originalShowOverlay,
        patchedShowOverlay(component, options) {
            const probe = component.render(tui.terminal.columns);
            const overlay =
                analyzePlanReviewLayout(probe) === undefined
                    ? component
                    : new PlannotatorPlanReviewOverlay(
                          component,
                          () => state.openPlan(),
                          () => tui.requestRender(),
                      );
            return originalShowOverlay.call(tui, overlay, options);
        },
        openPlan,
    };

    patchableTui[TUI_PATCH_STATE] = state;
    tui.showOverlay = state.patchedShowOverlay;

    return () => {
        if (patchableTui[TUI_PATCH_STATE] !== state) {
            return;
        }
        tui.showOverlay = originalShowOverlay;
        // Clean up symbol-indexed patch state on the host TUI instance during unpatch.
        // `delete` removes the property from the host object so future existence checks return false.
        delete patchableTui[TUI_PATCH_STATE];
    };
}

export function installPlanReviewPlannotatorHook(
    pi: ExtensionAPI,
    commands: ReadonlyMap<string, RegisteredCommand>,
): void {
    let currentContext: ExtensionContext | undefined;
    let activePlanPath: string | undefined;
    let removeTuiPatch: (() => void) | undefined;

    pi.on("session_start", async (_event, context) => {
        currentContext = context;
        activePlanPath = undefined;
        removeTuiPatch?.();
        removeTuiPatch = undefined;
        if (!context.hasUI) {
            return;
        }

        await context.ui.custom<void>((tui, _theme, _keybindings, done) => {
            removeTuiPatch = patchPlanReviewOverlays(tui, () => {
                openPlanInPlannotator(commands, currentContext, activePlanPath).catch(
                    (cause: unknown) => {
                        const message = cause instanceof Error ? cause.message : String(cause);
                        currentContext?.ui.notify(
                            `Failed to launch Plannotator: ${message}`,
                            "error",
                        );
                    },
                );
            });
            done();
            return {
                render: () => [],
            };
        });
    });

    pi.on("session_switch", (_event, context) => {
        currentContext = context;
        activePlanPath = undefined;
    });

    pi.on("tool_call", (event, context) => {
        currentContext = context;
        activePlanPath = planPathFromToolCall(event) ?? activePlanPath;
    });

    pi.on("session_shutdown", (_event, context) => {
        if (currentContext === context) {
            currentContext = undefined;
            activePlanPath = undefined;
        }
        removeTuiPatch?.();
        removeTuiPatch = undefined;
    });
}
