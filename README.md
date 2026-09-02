# OMP Plannotator

[![npm version](https://img.shields.io/npm/v/omp-plannotator.svg)](https://www.npmjs.com/package/omp-plannotator)
[![npm downloads](https://img.shields.io/npm/dm/omp-plannotator.svg)](https://www.npmjs.com/package/omp-plannotator)
[![CI](https://github.com/zigai/omp-plannotator/actions/workflows/ci.yml/badge.svg)](https://github.com/zigai/omp-plannotator/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/zigai/omp-plannotator.svg)](https://github.com/zigai/omp-plannotator/blob/main/LICENSE)

OMP extension adapter for [Plannotator](https://github.com/backnotprop/plannotator), bringing visual plan reviews, interactive code diff annotations, and plan-mode write gating to Oh My Pi.

## Installation

```sh
omp plugin install github:zigai/omp-plannotator
```

## Usage

### Slash Commands

The primary command is `/anno` (with `/plannotator` retained as an alias) to avoid collisions with OMP's built-in `/plan` command.

- `/anno` — Annotate the last assistant response (default).
- `/anno diff` — Open interactive code review for working tree git diff or staged changes.
- `/anno review <url>` — Open review for a GitHub PR or GitLab merge request URL.
- `/anno <path>` — Open visual annotation on a specific file or directory path.

### Plan Review Integration

During OMP plan mode, an option to annotate with Plannotator is automatically added to the plan approval dialog.

## License

[MIT](https://github.com/zigai/omp-plannotator/blob/main/LICENSE)
