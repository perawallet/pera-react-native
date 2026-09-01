# Architectural conformance rules

Project-specific conventions enforced by [lanekeep](https://github.com/fmsouza/lanekeep),
run as part of `pnpm lint`. Rules are registered in `lanekeep.config.ts`.

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
