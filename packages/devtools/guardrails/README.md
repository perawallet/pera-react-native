# Guardrails

Deterministic AST-based source-code checks for the Pera Wallet monorepo. Catches style and architecture violations that are easy to miss in large PRs and that ESLint/Oxlint don't already cover.

## Running

From the repo root:

```sh
pnpm lint:guardrails          # human-readable output, exits 1 on violations
pnpm lint:guardrails:warn     # human-readable output, exits 0 (warn-only)
pnpm lint:guardrails:json     # machine-readable JSON
```

`pnpm lint` chains `pnpm lint:guardrails:warn` after `turbo run lint`, so pre-push and CI surface violations without blocking while the backlog is cleared. Once the codebase is clean, flip the chain to `pnpm lint:guardrails` to start blocking.

## Flags

| Flag          | Effect                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--json`      | Emit JSON instead of the human report.                                                                                                                         |
| `--warn-only` | Still print violations, but exit `0` so the command does not fail the build. Intended for a phased rollout while existing violations are being worked through. |

## Environment overrides

| Variable                     | Effect                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GUARDRAILS_FORCE_WORKERS=1` | Bypass the file-count threshold and always use the worker pool. Useful for benchmarking and for verifying the worker path end-to-end in integration tests. |
| `GUARDRAILS_WORKERS=<N>`     | Cap the worker pool at `N` (positive integer). Otherwise the count is derived from CPU budget, file count, and `MAX_WORKERS`.                              |
| `NO_COLOR=1`                 | Disable ANSI coloring in human output. Respected automatically when stdout is not a TTY.                                                                   |

## Exit codes

| Code | Meaning                                                                               |
| ---- | ------------------------------------------------------------------------------------- |
| `0`  | No violations, or violations exist but `--warn-only` was passed.                      |
| `1`  | Violations exist and `--warn-only` was NOT passed.                                    |
| `2`  | Runtime error (a check threw, a file failed to parse, etc.). Stack printed to stderr. |

## Scope

Checks scan:

- `apps/mobile/src/**/*.{ts,tsx}`
- `packages/*/src/**/*.{ts,tsx}`

Excluded: `__tests__/`, `*.spec.{ts,tsx}`, `*.test.{ts,tsx}`, `node_modules`, `dist`, `build`, `.expo`, and `packages/devtools/**` itself.

## Current checks (Phase 1)

| Rule                         | What it enforces                                                                                                                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-numeric-sizes`           | No literal numeric spacing/sizing (`padding: 12`, `borderRadius: 16`, `-16`, …) inside `makeStyles(...)` objects. `0` is allowed. Use `theme.spacing.*`, `theme.borderRadius.*`, or `theme.borders.*`.                                                                                        |
| `no-typography-in-styles`    | No direct `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`, or `letterSpacing` inside `makeStyles(...)` objects. Use `getTypography(theme, variant)` from `@/theme/typography`, or `PWText` with a variant prop.                                                                          |
| `no-primitive-rn-components` | No `import { Text, View, ScrollView, FlatList, TouchableOpacity, Image, Switch } from 'react-native'` in app code. Use the PW-prefixed equivalents from `@components/core`. Files under `apps/mobile/src/components/core/` are exempt (those are the wrappers).                               |
| `no-error-toast-in-catch`    | No `showToast({ type: 'error', ... })` inside a `catch` clause or `.catch(...)` handler. Use `showError(err, fallbackTitle)` from `useErrorToast`. Static error toasts outside catch scopes (e.g. validation messages) are still allowed. `apps/mobile/src/hooks/useErrorToast.ts` is exempt. |

## Output format

```
path/to/file.ts:12:5 [rule-id] one-line message
  → Fix: actionable remediation

rule-id: 3 violation(s)
...
✖ 3 guardrail violation(s) across 1 rule(s) (total 312ms)
Per-check timings: rule-id=4ms other-rule=2ms
Stage timings: parse=245ms walk=37ms workers=0
```

- `parse` — CPU-time reading + `ts.createSourceFile`-ing files, summed across workers (wall-clock is lower when workers > 0).
- `walk` — CPU-time in the shared AST walker running all registered visitors.
- `workers` — `0` for the in-process path, `N ≥ 1` for the worker pool.

Violations are sorted by `(ruleId, file, line, column)` so output is stable across runs. ANSI colors disable automatically when stdout is not a TTY or when `NO_COLOR` is set.

## Suppressing a violation

Two directives are recognized in line or block comments:

```ts
// guardrails-ignore-next-line no-numeric-sizes reason: legacy API requires exact 44
minWidth: 44,
```

```ts
// guardrails-ignore-file no-primitive-rn-components reason: generated fixture
import { View } from 'react-native'
```

Multiple rule IDs may be listed, whitespace- or comma-separated:

```ts
// guardrails-ignore-next-line no-numeric-sizes, no-typography-in-styles
```

The directive must appear as a standalone token, so `my-guardrails-ignore-next-line-policy` in prose does not match.

## Adding a new check

Checks register kind-indexed visitors; the runner walks each file once and dispatches to every check registered for that node kind.

1. Create `checks/my-rule.check.ts` with a default-exported `Check`:

    ```ts
    import ts from 'typescript'
    import type { Check } from '../types.js'

    const check: Check = {
        id: 'my-rule',
        description: 'What this rule enforces.',
        visitors: {
            [ts.SyntaxKind.ImportDeclaration]: (node, sf, emit) => {
                // Inspect `node` (narrowed by the SyntaxKind key) and call
                // emit({ line, column, message, remediation }) on violations.
                // `ruleId` and `file` are injected automatically.
            },
        },
    }

    export default check
    ```

2. Add a matching spec under `__tests__/`. Parse a fixture SourceFile, then run the check through the shared walker:

    ```ts
    import { sharedWalk } from '../execute.js'
    import check from '../checks/my-rule.check.js'

    const violations: Violation[] = []
    sharedWalk(new Map([[sf.fileName, sf]]), [check], {}, violations)
    ```

3. `pnpm --filter @perawallet/wallet-core-devtools test`.
4. `pnpm lint:guardrails` from the repo root.

The runner auto-discovers anything ending in `.check.ts` in the `checks/` folder — no registration, no manual wiring.

### Helpers in `utils/ast.ts`

- `getLineCol(sf, pos)` — 1-based `{ line, column }`.
- `resolveNamedImport(sf, moduleSpecifier, importedName)` — local binding for a named import.
- `resolveModuleBindings(sf, moduleSpecifier)` — `Map<localName, importedName>` for all named imports from a module.
- `getMakeStylesBinding(sf)` — memoized local binding of `makeStyles` from `@rneui/themed` (or `null` if not imported).
- `descendMakeStylesCall(call, cb)` — given a confirmed `makeStyles(...)` `CallExpression`, yields each top-level style-entry object literal.

## Performance budget

Target: **~1s, hard ceiling 2s** for the full codebase.

**Architecture.** The runner discovers file paths only on the main thread, then either (a) reads + parses + walks in-process for small runs, or (b) farms file chunks to a `worker_threads` pool for large runs. Each worker runs the same `runChecksAgainstPaths` core, so behaviour is identical across modes. Checks share a single AST walk per file — registering a new visitor does not add another full sweep.

**Worker threshold.** Workers engage when file count ≥ `IN_PROCESS_THRESHOLD` (currently `3000`), or any time `GUARDRAILS_FORCE_WORKERS=1` is set. At today's codebase size (~1825 first-party `.ts`/`.tsx` files) the default path is in-process because per-worker `tsx` registration (~200ms × 4 workers) overwhelms the parallelism win. The threshold sits above today's size so workers engage automatically once the codebase grows or individual checks become expensive enough to amortise the spawn cost.

**Current measurements** (Apple Silicon, cold):

| Mode                                                     | Wall clock |
| -------------------------------------------------------- | ---------- |
| In-process (default, 3 simple checks, ~1800 files)       | ~1.3s      |
| Workers forced (`GUARDRAILS_FORCE_WORKERS=1`, 4 workers) | ~1.6s      |

Force-worker wall-clock improves dramatically once per-worker work dominates spawn cost (heavier checks, larger codebase).

## CI integration

CI picks up guardrails automatically via `pnpm lint` in `.github/workflows/pre-merge.yml`. A failing check fails the lint job.
