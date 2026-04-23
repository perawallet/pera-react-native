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

| Flag | Effect |
| ---- | ------ |
| `--json`       | Emit JSON instead of the human report. |
| `--warn-only`  | Still print violations, but exit `0` so the command does not fail the build. Intended for a phased rollout while existing violations are being worked through. |

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | No violations, or violations exist but `--warn-only` was passed. |
| `1`  | Violations exist and `--warn-only` was NOT passed. |
| `2`  | Runtime error (a check threw, a file failed to parse, etc.). Stack printed to stderr. |

## Scope

Checks scan:
- `apps/mobile/src/**/*.{ts,tsx}`
- `packages/*/src/**/*.{ts,tsx}`

Excluded: `__tests__/`, `*.spec.{ts,tsx}`, `*.test.{ts,tsx}`, `node_modules`, `dist`, `build`, `.expo`, and `packages/devtools/**` itself.

## Current checks (Phase 1)

| Rule | What it enforces |
| ---- | ---------------- |
| `no-numeric-sizes` | No literal numeric spacing/sizing (`padding: 12`, `borderRadius: 16`, `-16`, …) inside `makeStyles(...)` objects. `0` is allowed. Use `theme.spacing.*`, `theme.borderRadius.*`, or `theme.borders.*`. |
| `no-typography-in-styles` | No direct `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`, or `letterSpacing` inside `makeStyles(...)` objects. Use `getTypography(theme, variant)` from `@/theme/typography`, or `PWText` with a variant prop. |
| `no-primitive-rn-components` | No `import { Text, View, ScrollView, FlatList, TouchableOpacity, Image, Switch } from 'react-native'` in app code. Use the PW-prefixed equivalents from `@components/core`. Files under `apps/mobile/src/components/core/` are exempt (those are the wrappers). |

## Output format

```
path/to/file.ts:12:5 [rule-id] one-line message
  → Fix: actionable remediation

rule-id: 3 violation(s)
...
✖ 3 guardrail violation(s) across 1 rule(s) (total 312ms)
Per-check timings: rule-id=4ms other-rule=2ms
```

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

1. Copy `checks/_template.check.ts.example` to `checks/my-rule.check.ts`.
2. Fill in `id`, `description`, and implement `run(sources: SourceMap): Violation[]`.
3. Add a matching spec under `__tests__/`, with a fixture under `__tests__/fixtures/`.
4. Run `pnpm --filter @perawallet/wallet-core-devtools test` to confirm.
5. Run `pnpm lint:guardrails` from the repo root to see it fire against real code.

That's it — the runner auto-discovers anything ending in `.check.ts` in the `checks/` folder. No registration, no manual wiring.

Helpers available in `utils/ast.ts`:

- `getLineCol(sf, pos)` — 1-based `{ line, column }`.
- `resolveNamedImport(sf, moduleSpecifier, importedName)` — local binding for a named import.
- `resolveModuleBindings(sf, moduleSpecifier)` — `Map<localName, importedName>` for all named imports from a module.
- `forEachMakeStylesStyleObject(sf, cb)` — walks into each top-level style-entry object literal inside a `makeStyles(...)` call from `@rneui/themed`.

## Performance budget

Target: **~1s, hard ceiling 2s** for the full codebase. Each check receives a pre-parsed `ts.SourceFile` map, so parse cost is paid once per run regardless of how many checks exist. Checks run in parallel via `Promise.all`.

Current cold-run timings (3 checks, ~800 source files): roughly 1s wall clock on Apple Silicon.

## CI integration

CI picks up guardrails automatically via `pnpm lint` in `.github/workflows/pre-merge.yml`. A failing check fails the lint job.
