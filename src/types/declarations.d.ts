declare module "@plannotator/pi-extension/index.ts" {
    import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
    const plannotator: (pi: ExtensionAPI) => void;
    export default plannotator;
}

declare module "@plannotator/pi-extension" {
    import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
    const plannotator: (pi: ExtensionAPI) => void;
    export default plannotator;
}
