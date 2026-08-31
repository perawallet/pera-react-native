# Differential harness

Compares the guardrails runner against lanekeep on an identical corpus, per
rule, so a ported rule can be shown to catch what its predecessor caught.

    node lanekeep/__differential__/compare.mjs
    node lanekeep/__differential__/compare.mjs --rule no-numeric-sizes

Both tools are run with suppressions disabled, which turns the repo's live
`guardrails-ignore-next-line` directives into real violations at known
locations. That covers three rules with genuine positives from real code.

The other rules need seeded input. Seed by copying a real file that the rule
should fire on, editing in a violation, and placing the copy under a path the
config already includes — then revert it. A seed that only exists in a
scratch directory outside `apps/`, `packages/` or `extensions/` is invisible
to both tools and proves nothing.

`AGREE` on a rule is that rule's gate. `EXTRA` is only acceptable where the
design predicts it: the ported `error-message-key-exists` scans
`extensions/*/src` that the old rule could not reach, so extra violations
there are the widening working, not a defect.
