# Architectural conformance rules

Project-specific conventions enforced by [lanekeep](https://github.com/fmsouza/lanekeep),
run as part of `pnpm lint`. Rules are registered in `lanekeep.config.ts`.

`lanekeep` is maintained by Fred Souza (fmsouza), who also authored this migration.
`pnpm-workspace.yaml`'s `minimumReleaseAgeExclude` carries a dated, temporary exemption from
this repo's 7-day supply-chain quarantine for `lanekeep` and its four platform binaries — see
the comment there for what was verified and when the exemption expires.

    pnpm lint:lanekeep                    # whole repo
    pnpm exec lanekeep check --staged     # staged files only
    pnpm exec lanekeep explain pera/no-numeric-sizes

## Rules

| Rule                                 | What it enforces                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `pera/no-primitive-rn-components`    | No direct `react-native` primitive imports in app code; use the PW-prefixed wrapper from `@components/core`.                  |
| `pera/no-chrome-imports-outside-web` | A chrome-only package must not reach a native bundle.                                                                         |
| `pera/no-typography-in-styles`       | No `fontSize`/`fontFamily`/etc. set directly inside `makeStyles`; use `getTypography` or a `PWText` variant.                  |
| `pera/no-empty-style-objects`        | No style key that resolves to `{}`.                                                                                           |
| `pera/no-numeric-sizes`              | No literal numeric spacing/sizing inside `makeStyles`; use a `theme.spacing`/`theme.borderRadius`/`theme.borders` token.      |
| `pera/no-error-toast-in-catch`       | No `showToast({ type: 'error', ... })` from a `catch` clause or `.catch(...)` callback; use `showError` from `useErrorToast`. |
| `pera/error-message-key-exists`      | A `messageKey` must resolve to a string in `en.json`.                                                                         |
| `pera/error-params-match-copy`       | Every `{{placeholder}}` in the resolved copy has a matching `params` entry.                                                   |
| `pera/no-unused-style-keys`          | A `makeStyles` key must be referenced (statically or via a suppressed dynamic access).                                        |

This is the complete set of `pera/*` rules; none were deliberately excluded.

## Adding a rule

A rule is a tree-sitter query plus a handler that runs only on matches. Put it in
`rules/`, register it in `lanekeep.config.ts`, and add a `good`/`bad` fixture pair
under `__tests__/fixtures/` with a spec that asserts the exact violation set.

The `card` is not documentation — it is what an agent or a reviewer acts on, so
`remediation` should say what to do rather than restate the problem.

Add `gates` (`fileContains`, `pathMatches`, `pathNotMatches`) whenever the rule only
ever fires on a subset of files — every rule but `no-unused-style-keys` uses one, and
the whole run's performance depends on gated rules skipping the files their query
would never match anyway. `fileContains` is an **and** across its entries, not an
or: a rule needing "file contains A or B" cannot express that as a single gate and
needs either two gated rules or a hand-rolled check in `check()`.

A rule that needs to reason across files — not just within the one it's currently
handed — emits facts from `check()` with `ctx.emitFact()` and reads them back once,
after every file has run, in a `reduce(ctx)` hook via `ctx.facts(kind)`; `reduce` is
also where `ctx.report()` gets called for a cross-file rule, since no single file's
`check()` sees the whole picture. `no-unused-style-keys` is the only rule that does
this — see it for a worked example — and it is the subtlest code in this directory.

## Suppressing

    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: why this one is fine

The reason is mandatory and the id must be namespaced. A malformed directive is
reported rather than silently ignored.

## Gotchas

- lanekeep skips gitignored files on top of `lanekeep.config.ts`'s `exclude` list, so a
  generated file like `packages/config/src/generated-env.ts` can match `include` and still
  never be checked — expected, not a glob bug (see the comment in `lanekeep.config.ts`).
- The global wall-clock budget in `lanekeep.config.ts` is set well above the observed
  cold-cache run time: the per-rule budget catches one rule going quadratic, the global one
  has to absorb a cold parse of the whole corpus on a loaded CI runner.
- `pera/no-unused-style-keys` false-positives (reports every key as unused) on two working
  shapes it doesn't model. Both are known, not new bugs — recognize them rather than start
  deleting live code:
    - **Barrel re-export.** `export { useStyles } from './styles'` in an `index.ts`, with
      consumers importing from the folder (`./index` or `.`). The import resolver lands on
      `index.ts`, so the owner id it records never matches the id the `styles.ts` keydefs were
      recorded under, and every key in that hook reports as unused. This repo's own convention
      puts an `index.ts` in every component folder, so this is one barrel-re-exported styles
      hook away from firing for real.
    - **Inline call form.** `useStyles({ x }).container` used directly, with no intermediate
      `const styles = useStyles(...)` variable. The usage pass only runs off a
      `variable_declarator`, so a hook only ever consumed this way looks completely unread.
      Suppress a genuine false positive with a `lanekeep-ignore-next-line` and a reason rather
      than restructuring working code to dodge the resolver.
