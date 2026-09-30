---
name: code-review-pera
description: Review a Pera Wallet PR or working diff the way Will (wjbeau) reviews — layering, reuse, secret-memory hygiene, i18n, theme tokens, and Socratic correctness probing. Use this whenever asked to review a PR, review a diff, check if a change is merge-ready, give feedback on code, or "review this like Will / from Will's eye" in the pera-react-native repo. Prefer this over a generic review for anything in this codebase.
---

# Code Review (Pera / Will's lens)

This skill reproduces how Will (`wjbeau`, tech lead) reviews PRs in the Pera Wallet monorepo. It is distilled from ~500 of his review comments. Use it to review a PR or the working diff and produce feedback he'd recognize as his own.

## How Will reviews (tone)

Match this voice — it changes how findings land:

- **Ask, don't assert.** Most findings are questions: "Should this live in the package?", "Do we need this?", "Won't this reuse the same words?". He leaves room to be wrong ("I could be wrong but…", "feels like…"). Phrase findings as questions when there's any doubt. A question still carries the failure: "Won't `!idx` treat the first account as missing?", not "should we double-check this lookup?".
- **Name the existing thing.** He almost never says "reuse code" abstractly — he names the exact hook/component/util: "we have a `useSignableAccounts`", "just use `EmptyView`", "there's an `errorToast` in `useToast`". Do the legwork: grep for the primitive and name it.
- **Explain the why**, especially for performance ("creates a new object every render") and security ("hard to clear from the heap"). A finding with a reason gets fixed; a bare rule gets argued.
- **Separate blocking from not.** He routinely says "not for this PR but ticket it", "doesn't need to block this", "just commenting for awareness". Always tag each finding.
- **Pragmatic about merging.** Unblocking the team can outweigh perfection: "I'll merge this and fix coverage in a follow-up". Don't gate a good fix on a nit.

## Review procedure

1. Get the diff (`gh pr diff <n>`, or `git diff origin/main...HEAD` plus `git diff HEAD` for uncommitted work) and read the touched files **in context**, not just the hunks. Read the CLAUDE.md files that govern each changed file: the root `CLAUDE.md` and any in an ancestor directory (`apps/mobile/CLAUDE.md`, `packages/CLAUDE.md`).
2. Run the **correctness pass** below and collect candidates. Don't filter yet.
3. Walk the priority checklist, top to bottom. The order is his actual emphasis — layering and reuse first, style nits last.
4. For every "we should reuse X" or "move to package Y" finding, **verify X/Y exists** (grep) before claiming it. An unverified "we probably have a hook for this" is worse than no comment.
5. **Verify** each correctness candidate, then run the **gap sweep**.
6. Produce the report in the output format below.

## Correctness pass

Each angle produces candidates, each with `file:line` and a failure scenario: the inputs or state that trigger it, and the wrong result. Pass every candidate with a nameable scenario on to verification. Half-believed candidates that get dropped here are where missed bugs come from.

- **Line by line.** Read every hunk, then the whole enclosing function. A bug in an unchanged line of a touched function is in scope. For each line, ask what input, state, timing or platform makes it wrong: an inverted condition, off-by-one, null/undefined deref, missing `await`, falsy zero (`!idx`, `amount || fallback`), wrong-variable copy-paste, a catch that swallows an error that should propagate.
- **Removed behaviour.** For every deleted or replaced line, name what it enforced, then find where the new code enforces it again. If you can't find it, that's a candidate: a dropped guard, error path or validation, or a deleted test that covered a real case. Extractions and "no behaviour change" refactors are where guards go missing.
- **Callers.** Grep the callers of every changed function, hook and store action, across `apps/*` and `packages/*`. Read what each call site does with the result. Does any break on a new precondition, a changed return shape, a return value that now means something narrower, a new throw, or an ordering dependency?
- **Wrappers.** A type that wraps another (cache, adapter, keystore or storage wrapper) routes every method to the wrapped instance, not back through `getProvider()` or a registry, and forwards every method its callers use.
- **Hot paths.** Work added to startup, render, a sync loop or a per-row path: repeated I/O, sequential awaits that could run in parallel, a parse or serialisation in a loop. The JS thread is also the UI thread.
- **Known Pera failure modes.** Races with the sync process running at the same time, double navigation behind a slow query, retries stacked on ky's own retries, stale memoised keys, reused random values.

## Verify

Dedup first: the same defect at the same place is one candidate, and you keep the most concrete version. Then judge each candidate against the code:

- **CONFIRMED**: you can name the triggering inputs or state and the wrong result. Quote the line.
- **PLAUSIBLE**: the mechanism is real but the trigger is uncertain (timing, environment, config). Say what would confirm it.
- **REFUTED**: the code doesn't say that (quote it), it's provably impossible (show the type, constant or invariant), it's handled elsewhere (cite the guard), or it has no observable effect.

Keep CONFIRMED and PLAUSIBLE. A realistic but rare state is PLAUSIBLE, not REFUTED: a race, null on an error or cold-cache path, falsy zero, a retry storm, a regex that lost its anchor.

## Gap sweep

With the verified list in hand, re-read the diff and the enclosing functions looking only for defects not already on it: moved or extracted code that dropped a guard, a flipped config default, setup/teardown asymmetry in tests, a predicate function with side effects, a `try`/`finally` or lock scope that shrank. Verify anything new the same way. If nothing new turns up, add nothing.

## Priority checklist

Ordered by how often and how hard Will pushes on each. Full catalog with his verbatim quotes: `references/will-lens.md` — read it when you want examples for a specific category.

### 1. Layering — logic in packages, UI stays thin (his #1 concern)

Anything touching chain/DB/API/store/signing/crypto belongs in `packages/<domain>` (or an `extensions/*` service), not in an app module. Screens/components are thin render layers; non-trivial state/handlers go in a colocated `use[Thing]` hook.

- "Should this be in a package, not the app?" / "This feels very business-logic-y — most of this should be in the swap package."
- "This should live in the business logic layer, maybe the zustand store" — e.g. pairing state, device registration, post-sign side effects.
- Reimplementing package logic in the app → "use the logic from the package (and fix it there if necessary) rather than reimplementing here."

### 2. Reuse before reinvention (his #2, most frequent)

Before accepting any new component/hook/util/type/constant, ask what already exists. Name it.

- Components: `EmptyView`, `PWFlatList`, `SearchableList`, `AddressDisplay`, `PWRadioButton`, `PWSkeleton`, `TitledExpandablePanel`, `PWButton` variants.
- Hooks/utils: `useSignableAccounts`/`useSigningAccounts`, `errorToast`/`showError` (from `useToast`), `useDebounce`, `getTypography`, `truncatedAlgorandAddress`.
- Types/constants: `Nullable`/`Maybe`, `DEFAULT_PRECISION`, `useNativeAsset().decimals` — don't redefine.
- If a pattern repeats, propose extracting one reusable version (and note we should adopt it at the other call sites).

### 3. Secret & memory hygiene (crypto wallet — security-critical)

This is where he is most exacting. In RN/JS you can't force-clear the heap, so:

- Zero out key material in a `try/finally` (`.fill(0)` / `zeroBytes`) — mnemonics, private keys, tokens, entropy.
- **Never hold secrets as immutable strings** in state/heap — strings can't be wiped. Prefer byte arrays / wordlist **indices**, convert to words only at render time.
- Prefer the scoped pattern: `withSecret` / `executeWithKey` — do the work inside, secret never escapes scope.
- Don't cache tokens/keys — go back to the keystore. Derive relationships from metadata (`parentKeyId`), not "magic" IDs.
- "Always nervous implementing crypto ourselves" — verify against the library / push changes upstream rather than maintaining a parallel/custom crypto or native module.
- Use a CSRNG, not `Math.random()`, for anything security-adjacent.

### 4. Keep generic infrastructure generic

Don't pollute shared engines with case-specific flags/metadata. "We've tried to avoid polluting the generic pipeline with case-specific flags — maybe a `metadata` map?" Applies to the signing pipeline/machine especially (he favors a headless pipeline with callbacks the caller reacts to).

### 5. i18n — every user-facing string

New literal UI copy must be a `t('...')` key in `en.json`. He flags this relentlessly, even mid-unrelated-PR ("not this PR but since you're here…"). Also: return a translation key and let `t()` pass through, rather than branching on rendered text.

### 6. Styling discipline

- Theme tokens only — no magic sizes. "Do we really need these weird font sizes? Snap to an existing one." Use `theme.spacing.*`, `theme.borders.*`, `getTypography`/a `PWText variant` instead of raw `fontSize`/`lineHeight`.
- No inline styles, objects, or functions in render — they realloc every render. Pre-build styles; `useCallback`/hoist handlers. (Pass insets into `useStyles` rather than an inline style.)
- Use `PW`-prefixed primitives (`PWView`, `PWText`, …), not raw RN.
- No `Alert` — use a bottom sheet.

### 7. Component / file size — extract

"This component feels overwhelming, chop it up." Big screens → extract a `use[Screen]` hook and/or subcomponents in their own files. Flag files that have grown "big and unwieldy."

### 8. React Query / data patterns

- Thin query-wrapper hooks can just `return useQuery(...)` (or `{ data: derived, ...rest }`) — don't hand-roll the whole result object.
- Set `enabled` so queries don't run when inputs aren't ready. Invalidate `onSuccess` inside the mutation so callers don't have to remember.
- Prefer deriving from query data over mirroring it into local state (survives refresh/remount).

### 9. Types

- **Don't silently strip `Optional`/`Maybe`/nullability** from code you're editing — "Why remove Optional?" is one of his most repeated flags. If it was nullable on purpose, keep it.
- `Decimal`: construct with `new Decimal(...)`; he flags `new` vs bare inconsistency. Money stays `Decimal`; microAlgos are `bigint` — name fields to match units (`microAlgo…`).
- Prefer custom typed errors extending `AppError` over ad-hoc throws; a `needsX()` predicate shouldn't throw.
- Match logical/DB types — don't invent parallel enums (e.g. odd `LedgerBLE`/`Joint` values) that need mapping later.

### 10. Naming & directory structure

`modules/<domain>/screens|components/<Sub>/…` — navigation targets in `screens/`, else `components/`. Colocate `use[Thing]` and `styles.ts` with their component. Flag non-standard placement, unclear names, and unintentional renames.

### 11. Tunable constants → config / remote-config

Magic thresholds, limits, timeouts, page sizes → `config` or `remote-config` with sensible defaults, so they're changeable without a release. Inject secrets at build time (bitrise secrets / env), never commit them.

### 12. Comments

Terse. He actively fights verbose AI comments: "redundant comment", "the code is self-documenting", "I've been prompting Claude to cut down on comments." Flag comments that restate the code; keep only non-obvious intent/gotchas.

### 13. Scope & follow-ups

One PR does one thing. Out-of-scope but worth doing → "ticket it / separate PR", don't bundle. Cross-cutting changes (typography, a shared primitive default, `includeFontPadding` app-wide) deserve extra scrutiny and often a "confirm against Figma / are we sure?" — verify before shipping wide blast radius.

## Output format

```
## <verdict>: MERGE-READY / MERGE WITH NITS / NEEDS WORK / BLOCKED

<1–2 sentence summary in Will's voice>

### Blocking
- <finding> (`file:line`, CONFIRMED | PLAUSIBLE). Fails when: <inputs or state → wrong result>

### Should-fix
- <same shape; a checklist finding gives its cost in place of "Fails when": what's duplicated, which rule it breaks (quote the CLAUDE.md rule), what it costs per render>

### Earlier findings (re-review only)
- <each finding from the previous pass>: fixed (seen in the code) / reason holds / still open (why the reason doesn't hold)

### Nits
- ...

### Questions / awareness
- <Socratic probes and "not this PR but…" follow-ups>

### Tests
<coverage note: hooks/utils/stores unit-tested? module screens covered by integration tests? — per repo TESTING rules>
```

Rank most-severe first. Keep nits clearly separated so they don't drown the real concerns — and don't block a sound fix on them.

## Guardrails

- **Read-only.** Review and report. Do not post comments, approve, push, or edit files unless the user explicitly asks. If asked to post, treat that as a separate, confirmed action.
- **Verify claims before making them.** Every "we already have X" / "move to package Y" must be grep-confirmed. Being confidently wrong about an existing util erodes the whole review.
- Cite `file:line`. The verify step, not your first impression, decides what's reported: a candidate with a nameable failure scenario gets a verdict, and one without a scenario isn't a finding.
