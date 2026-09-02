import type { ExtensionAPI as PiExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import plannotator from "@plannotator/pi-extension/index.ts";
import { createOmpPlannotatorHostAdapter } from "./adapter/host-adapter.ts";
import { registerPlannotatorCommand } from "./command/command-router.ts";
import { installPlanReviewPlannotatorHook } from "./tui/tui-patcher.ts";

export default function ompPlannotator(pi: ExtensionAPI): void {
    const adapter = createOmpPlannotatorHostAdapter(pi);

    // SAFETY: OMP provides Pi compatibility modules and the adapter translates
    // behaviorally divergent methods (sendUserMessage, tool_call edit paths).
    /* oxlint-disable-next-line antislop/no-chained-type-assertions, typescript/no-unsafe-type-assertion */
    const adaptedPiApi = adapter.api as unknown as PiExtensionAPI;
    plannotator(adaptedPiApi);
    installPlanReviewPlannotatorHook(pi, adapter.commands);

    registerPlannotatorCommand(pi, adapter.commands);
}
