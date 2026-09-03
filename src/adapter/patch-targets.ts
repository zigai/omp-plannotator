import { Patch } from "@oh-my-pi/hashline";
import type { OmpEditPayload } from "../types/index.ts";

/**
 * Derive authoritative target and destination file paths from an OMP edit payload.
 */
export function extractOmpEditTargets(
    input: Readonly<OmpEditPayload>,
    cwd: string,
): readonly string[] {
    const targets: string[] = [];

    if (typeof input.path === "string" && input.path.length > 0) {
        targets.push(input.path);
    }

    if (Array.isArray(input.paths)) {
        for (const candidatePath of input.paths) {
            if (typeof candidatePath === "string" && candidatePath.length > 0) {
                targets.push(candidatePath);
            }
        }
    }

    if (typeof input.input === "string" && input.input.length > 0) {
        try {
            const patch = Patch.parse(input.input, { cwd });
            if (patch.sections.length > 0) {
                for (const section of patch.sections) {
                    if (typeof section.path === "string" && section.path.length > 0) {
                        targets.push(section.path);
                    }
                    const parsed = section.parse();
                    if (
                        parsed.fileOp?.kind === "move" &&
                        typeof parsed.fileOp.dest === "string" &&
                        parsed.fileOp.dest.length > 0
                    ) {
                        targets.push(parsed.fileOp.dest);
                    }
                }
            }
        } catch {
            // Hashline parsing did not succeed; non-hashline payloads yield no targets.
        }
    }

    return Array.from(new Set(targets));
}
