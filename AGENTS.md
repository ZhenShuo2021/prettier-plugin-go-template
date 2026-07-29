# Agent Guidelines

## Project Overview

Prettier plugin that formats Hugo/Go template files. Peer dependency: `prettier ^3.0.0`. TypeScript source lives in `src/`, compiled output in `dist/`.

## Documentation

- Developer-facing docs live under [docs/develop](docs/develop).
- Add new docs to the appropriate folder instead of the repository root.
- Keep this file in sync with any documentation or workflow changes.

## Architecture

Architecture and project structure details are centralized in [docs/develop/structure.md](docs/develop/structure.md).

## Commands

```bash
pnpm run build       # Build plugin artifacts with tsdown → dist/
pnpm test            # Run all fixture tests (Vitest)
pnpm run test:runtime # Build then import dist/index.mjs in plain Node ESM (packaging/runtime smoke test)
pnpm run coverage    # Tests with coverage report
pnpm run lint        # oxlint
pnpm run format      # prettier --write .
pnpm run build:watch # Watch-mode build
pnpm run release:coverage # Coverage-only release helper
pnpm run release:plugin   # Runtime smoke test + coverage + npm publish
```

> **Pre-commit**: `lefthook` runs `lint` + `format` in parallel on every commit. See [lefthook.yaml](lefthook.yaml).  
> **CI**: `pnpm install --frozen-lockfile && pnpm test` on PRs to `main`/`dev`. See [.github/workflows/test.yaml](.github/workflows/test.yaml).
> **Package manager**: this repo uses pnpm, pinned via the `packageManager` field in [package.json](package.json). Run `corepack enable` (or `npm i -g pnpm@10.33.4`) before running any command above.

## Testing

Fixture-based; test harness is [`src/index.spec.ts`](src/index.spec.ts).

Each test case is a subdirectory under [`src/tests/`](src/tests/):

```text
src/tests/<test-name>/
  input.html     # template to format
  expected.html  # expected output — or Error("message") to assert a thrown error
  config.json    # optional: prettier option overrides
```

All subdirectories are **auto-discovered** — no manual registration. A **second format pass** is always run; it must produce identical output (idempotency check).

**To add a test**: create the folder with `input.html` and `expected.html`, then `pnpm test`.

## Key Pitfalls

- **Idempotency is enforced**: formatting the output a second time must equal the first result; violations are test failures.
- **`oxlint` is the standard linter** — keep documentation and scripts aligned with `package.json` lint commands.
- **`<script>` / `<style>` blocks** containing `{{}}` become `GoUnformattable` nodes and must be preserved byte-for-byte.
- **Stack-based parser**: unmatched `{{end}}` blocks throw `Error("Missing end block.")` — cover new block types with an error fixture.

## Documentation Upkeep

**When modifying `src/` files or `package.json`**, review and update this file before ending your turn. Keep commands, architecture, options, and pitfalls in sync with the implementation. Outdated documentation is treated as a bug.
