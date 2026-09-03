# OMP Plannotator

[![CI](https://github.com/zigai/omp-plannotator/actions/workflows/ci.yml/badge.svg)](https://github.com/zigai/omp-plannotator/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/zigai/omp-plannotator.svg)](https://github.com/zigai/omp-plannotator/blob/main/LICENSE)

[Plannotator](https://github.com/backnotprop/plannotator) extension for [Oh My Pi](https://github.com/can1357/oh-my-pi).

## Installation

```sh
omp plugin install github:zigai/omp-plannotator
```

## Usage

### Slash Commands

The primary command is `/anno` to avoid collisions with OMP's built-in `/plan` command. `/plannotator` is retained as an alias.

Typing `/anno` provides inline ghost text help (`/anno diff | review | <path>`):

- `/anno` — Annotate the last assistant response (default).
- `/anno diff` — Open interactive code review for working tree git diff or staged changes.
- `/anno review <url>` — Open review for a GitHub PR or GitLab merge request URL.
- `/anno <path>` — Open visual annotation on a specific file or directory path.

### Plan Review Integration

During OMP plan mode, an option to annotate with Plannotator is added to the plan approval dialog.

## License

[MIT](https://github.com/zigai/omp-plannotator/blob/main/LICENSE)
