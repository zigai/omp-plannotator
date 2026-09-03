export const ANNO_COMMAND_NAME = "anno";
export const PLANNOTATOR_COMMAND_NAME = "plannotator";
export const PLANNOTATOR_GHOST_HINT = "diff | review | <path>";

export interface AnnoSubcommandDef {
    readonly name: string;
    readonly description: string;
    readonly usage?: string;
}

export const ANNO_SUBCOMMANDS: readonly AnnoSubcommandDef[] = [
    {
        name: "diff",
        description: "Open interactive code review for working tree git diff or staged changes",
    },
    {
        name: "review",
        description: "Open review for a GitHub PR or GitLab merge request URL",
        usage: "<url>",
    },
    {
        name: "last",
        description: "Annotate the last assistant response (default)",
    },
] as const;

export const REQUIRED_UPSTREAM_COMMANDS = [
    "plannotator-review",
    "plannotator-annotate",
    "plannotator-last",
] as const;
