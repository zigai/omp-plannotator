// SAFETY: Vitest test environment polyfill for Bun globals.
/* oxlint-disable typescript/no-unsafe-type-assertion, antislop/require-safety-comment-for-type-assertion, antislop/no-unsafe-dictionary-type, antislop/no-runtime-typeof */
const globalObj = globalThis as Record<string, unknown>;
if (typeof globalObj.Bun === "undefined") {
    globalObj.Bun = {
        env: process.env,
        Transpiler: class {
            transformSync(code: string) {
                return code;
            }
        },
        plugin: () => {},
        hash: (s: string, seed?: number) => {
            void seed;
            let h = 0;
            for (let i = 0; i < s.length; i++) h = Math.trunc(Math.imul(31, h) + s.charCodeAt(i));
            return BigInt(h);
        },
        which: () => null,
        stringWidth: (s: string) => s.length,
    };
}
