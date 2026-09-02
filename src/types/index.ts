import type { ExtensionAPI, RegisteredCommand } from "@oh-my-pi/pi-coding-agent";
import type { TUI } from "@oh-my-pi/pi-tui";

export const TUI_PATCH_STATE = Symbol.for("omp-plannotator.planReviewTuiPatch");

export interface OmpPlannotatorHostAdapter {
    readonly api: ExtensionAPI;
    readonly commands: ReadonlyMap<string, RegisteredCommand>;
}

export interface PlanReviewLayout {
    readonly actionsFocused: boolean;
    readonly lastHostOptionRow: number;
    readonly lastHostOptionLabel: string;
    readonly precedingHostOptionRow: number;
    readonly removeRow: number;
    readonly selectedHostOptionRow: number | undefined;
    readonly unselectedTemplateRow: number;
}

export interface RenderedLayout {
    readonly insertedOptionRow: number;
    readonly removeRow: number;
}

export interface TuiPatchState {
    readonly originalShowOverlay: TUI["showOverlay"];
    readonly patchedShowOverlay: TUI["showOverlay"];
    openPlan: () => void;
}

export type PatchableTui = TUI & {
    [TUI_PATCH_STATE]?: TuiPatchState;
};

export interface OmpEditPayload {
    readonly path?: unknown;
    readonly paths?: unknown;
    readonly input?: unknown;
}
