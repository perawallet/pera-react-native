# Architectural conformance rules

Project-specific conventions enforced by [lanekeep](https://github.com/fmsouza/lanekeep),
run as part of `pnpm lint`. Rules are registered in `lanekeep.config.ts`. A new project rule
that is per-file syntax over files oxlint already lints belongs in oxlint instead: a
built-in, or the `pera` plugin in `apps/mobile/scripts/oxlint-pera-plugin.mjs`. lanekeep
takes the rest: rules that need tests or tooling in view, another file's content
(`en.json`), cross-file facts, or findings located in JSON.

    pnpm lint:lanekeep                    # whole repo; also reports unused suppressions
    pnpm lint:fix                         # lanekeep's safe fixes, then oxlint's
    pnpm exec lanekeep check --staged     # staged files; cross-file rules are skipped
    pnpm exec lanekeep explain pera/no-numeric-sizes

## Rules

| Rule                                       | What it enforces                                                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pera/no-primitive-rn-components`          | No direct `react-native` primitive imports in app code; use the PW-prefixed wrapper from `@components/core`.                                                                                                      |
| `pera/no-chrome-imports-outside-web`       | A chrome-only package must not reach a native bundle.                                                                                                                                                             |
| `pera/no-cross-protocol-imports`           | A `v1/` sibling directory must not import from `v2/`, or vice versa — including type-only imports.                                                                                                                |
| `pera/no-wc-imports-in-connections-module` | Nothing in the connections module or the deeplink handlers imports the WalletConnect package; pairing stays protocol-agnostic.                                                                                    |
| `pera/no-deep-module-imports`              | Code outside an app module imports it only through a public entry (`index`, `routes`, `shell`, `web`); see `apps/mobile/CLAUDE.md`.                                                                               |
| `pera/no-typography-in-styles`             | No `fontSize`/`fontFamily`/etc. set directly inside `makeStyles`; use `getTypography` or a `PWText` variant.                                                                                                      |
| `pera/no-empty-style-objects`              | No style key that resolves to `{}`.                                                                                                                                                                               |
| `pera/no-numeric-sizes`                    | No literal numeric spacing/sizing inside `makeStyles`; use a `theme.spacing`/`theme.borderRadius`/`theme.borders` token.                                                                                          |
| `pera/no-error-toast-in-catch`             | No `showToast({ type: 'error', ... })` from a `catch` clause or `.catch(...)` callback; use `showError` from `useErrorToast`.                                                                                     |
| `pera/error-message-key-exists`            | A `messageKey` must resolve to a string in `en.json`.                                                                                                                                                             |
| `pera/error-params-match-copy`             | Every `{{placeholder}}` in the resolved copy has a matching `params` entry.                                                                                                                                       |
| `pera/no-unused-style-keys`                | A `makeStyles` key must be referenced (statically or via a suppressed dynamic access).                                                                                                                            |
| `pera/copyright-header`                    | Every `.ts`/`.tsx` file under `apps/*/src`, `packages/*/src`, `extensions/*/src` and `conformance/src`, tests included, opens with the Apache licence header in `shared/copyright.ts`. `pnpm lint:fix` writes it. |
| `pera/no-work-item-refs`                   | No ticket, milestone or task reference in a code comment, in any TS/JS file. Markdown, shell and YAML are `pnpm lint:docs`'s.                                                                                     |
| `pera/locale-key-parity`                   | Every locale imported by `apps/mobile/src/i18n/locales.ts` has exactly `en.json`'s keys; an extra plural variant is allowed only where `en.json` pluralises the base. Cross-file: skipped under `--staged`.       |
| `pera/translation-key-exists`              | A literal `t('…')` key is a leaf in `en.json`; a plural base counts.                                                                                                                                              |
| `pera/no-unused-translation-keys`          | Every `en.json` key is claimed by a string literal, a template head or an ancestor path, or (outside `errors.*`) by a plural base or `EXCLUDED_KEYS`. Cross-file: skipped under `--staged`.                       |
| `pera/no-i18n-integrity-suppressions`      | The i18n integrity rules above can't be suppressed: a missing, extra or unused key has no legitimate exception.                                                                                                   |
| `pera/pq-library-seam`                     | Only `packages/kms/src/crypto/pq` imports `falcon-1024` or `@joe-p/react-native-falcon`, in any import form; build configs, tests, e2e and `tools/` are out of scope.                                             |

This is the complete set of lanekeep's `pera/*` rules.

## Scope

`lanekeep.config.ts` includes every TS/JS file in the repo, tests and tooling included, because the
repo-wide rules must see them. A rule about shipped source narrows itself with the gates in
`shared/scope.ts`: `productionSource()` for a rule with no path of its own, `withoutTests()` for
one that already has `pathMatches`.

In gate globs `*` also matches `/`, so `**/packages/*/src/**` admits any nested `src` under a
package; `TEST_FILES` therefore drops any `__tests__` directory under a workspace root.

Write every path gate with a leading `**/`, and never exclude a bare `**/__tests__/**`: fixtures
live under `lanekeep/__tests__/fixtures/`, mirror real paths, and must stay visible to the rule
under test. Never name a fixture `*.spec.*` or `*.test.*`, or vitest runs it as a suite.

## Adding a rule

A rule is a tree-sitter query plus a handler that runs only on matches. Put it in
`rules/`, register it in `lanekeep.config.ts`, and add a `good`/`bad` fixture pair
under `__tests__/fixtures/` with a spec that asserts the exact violation set.

A rule runs only on the languages it declares, TypeScript and TSX by default; declare
`javascript` too for a rule that must see `.js`/`.mjs`/`.cjs`, with one query per grammar
where the grammars differ.

The `card` is not documentation — it is what an agent or a reviewer acts on, so
`remediation` should say what to do rather than restate the problem.

Add `gates` (`fileContains`, `pathMatches`, `pathNotMatches`) whenever the rule only
ever fires on a subset of files — every rule uses one; `no-unused-style-keys` has only
a path gate, because a content gate would drop consumers its reduce pass needs, and
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

Whole-file `lanekeep-ignore-file` directives are refused (`suppressions.forbidFileScope` in
`lanekeep.config.ts`). `pnpm lint:lanekeep` warns about a directive that no longer suppresses
anything; delete it.

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
