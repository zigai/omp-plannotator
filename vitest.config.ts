import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        setupFiles: [resolve(import.meta.dirname, "test/setup.ts")],
        server: {
            deps: {
                inline: [/@oh-my-pi\/.*/],
            },
        },
    },
    define: {
        "import.meta.dir": "process.cwd()",
    },
    resolve: {
        alias: {
            "@oh-my-pi/pi-natives": resolve(import.meta.dirname, "test/mocks/pi-natives.ts"),
            "bun:ffi": resolve(import.meta.dirname, "test/mocks/bun-ffi.ts"),
            "bun:sqlite": resolve(import.meta.dirname, "test/mocks/bun-sqlite.ts"),
            bun: resolve(import.meta.dirname, "test/mocks/bun.ts"),
        },
    },
    plugins: [
        {
            name: "raw-text-files",
            transform(code, id) {
                if (id.endsWith(".md") || id.endsWith(".lark") || id.endsWith(".html")) {
                    return {
                        code: `export default ${JSON.stringify(code)};`,
                        map: null,
                    };
                }
            },
        },
    ],
});
