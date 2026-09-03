// SAFETY: Vitest test environment polyfill for Bun globals.
/* oxlint-disable typescript/no-unsafe-type-assertion, antislop/require-safety-comment-for-type-assertion, antislop/no-unsafe-dictionary-type, antislop/no-runtime-typeof */
const globalObj = globalThis as Record<string, unknown>;
if (typeof globalObj.Bun === "undefined") {
    globalObj.Bun = {
        env: process.env,
        stringWidth: (s: string) => s.length,
    };
}
