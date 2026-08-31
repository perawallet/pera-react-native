# Differential harness

Compares the guardrails runner against lanekeep on an identical corpus, per
rule, so a ported rule can be shown to catch what its predecessor caught.

    node lanekeep/__differential__/compare.mjs
    node lanekeep/__differential__/compare.mjs --rule no-numeric-sizes

`--rule <id>` only accepts a rule id that is currently registered in
`lanekeep.config.ts` (namespace stripped) — it looks the registered set up
itself via `lanekeep rules --json` and refuses to run (exit 2) on a missing
value or an id nothing has registered. Register the rule under test before
scoping to it; there is nothing to compare against for a rule that hasn't
been ported yet.

Both tools are run with suppressions disabled, which turns the repo's live
`guardrails-ignore-next-line` directives into real violations at known
locations. That covers three rules with genuine positives from real code.

The other rules need seeded input. Seed by copying a real file that the rule
should fire on, editing in a violation, and placing the copy under a path the
config already includes — then revert it. A seed that only exists in a
scratch directory outside `apps/`, `packages/` or `extensions/` is invisible
to both tools and proves nothing.

`AGREE` on a rule is that rule's gate — and that gate is not vacuous.
Whether a rule counts as "ported" comes from `lanekeep.config.ts`'s
registration, not from whether it happened to emit anything: a rule that is
registered but fires on nothing (a typo'd query, a gate that matches no
file) is compared against guardrails' real violations for that rule id and
reported as `MISSING`, the same as if it were never written. Only a rule
absent from the config entirely is skipped as not-yet-ported.

`EXTRA` is only acceptable where the design predicts it: the ported
`error-message-key-exists` scans `extensions/*/src` that the old rule could
not reach, so extra violations there are the widening working, not a defect.
