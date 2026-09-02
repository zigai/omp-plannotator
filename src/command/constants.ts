export const ANNO_COMMAND_NAME = "anno";
export const PLANNOTATOR_COMMAND_NAME = "plannotator";
export const PLANNOTATOR_GHOST_HINT = "diff | review | <path>";

export const REQUIRED_UPSTREAM_COMMANDS = [
    "plannotator-review",
    "plannotator-annotate",
    "plannotator-last",
] as const;
