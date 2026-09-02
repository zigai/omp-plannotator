import { describe, expect, it } from "vitest";
import { resolveUserMessageOptions } from "../../../src/adapter/turn-resolver.ts";
import { createTestExtensionContext } from "../../harness/extension-ctx.ts";

describe("resolveUserMessageOptions", () => {
    it("translates followUp to undefined when session is idle", () => {
        const { context } = createTestExtensionContext({ idle: true });
        const result = resolveUserMessageOptions({ deliverAs: "followUp" }, context);
        expect(result).toBeUndefined();
    });

    it("preserves followUp when session is streaming (not idle)", () => {
        const { context } = createTestExtensionContext({ idle: false });
        const result = resolveUserMessageOptions({ deliverAs: "followUp" }, context);
        expect(result).toEqual({ deliverAs: "followUp" });
    });

    it("preserves steer delivery mode unchanged even when idle", () => {
        const { context } = createTestExtensionContext({ idle: true });
        const result = resolveUserMessageOptions({ deliverAs: "steer" }, context);
        expect(result).toEqual({ deliverAs: "steer" });
    });

    it("preserves undefined options", () => {
        const { context } = createTestExtensionContext({ idle: true });
        const result = resolveUserMessageOptions(undefined, context);
        expect(result).toBeUndefined();
    });

    it("preserves options when context is undefined", () => {
        const result = resolveUserMessageOptions({ deliverAs: "followUp" }, undefined);
        expect(result).toEqual({ deliverAs: "followUp" });
    });
});
