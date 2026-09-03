---
name: writing-docs
description: Write or revise a doc, README, module doc or code comment in this repo. Use before adding any prose to the codebase, and when asked to clean up documentation or comment verbosity. Covers what earns a place, what to cut, and how to verify the claims are still true.
---

# Writing docs and comments

Two failure modes, and the second is the common one.

Too little: a reader hits a landmine nobody warned them about. Too much: real signal is buried in
narration nobody trusts enough to read, and it rots, because prose about a moving codebase goes stale
while the code keeps working.

Optimise for the reader six months out who has no idea what happened this week.

## The test

Before writing a sentence, ask: **would this still be true and useful if every person currently on
the team had left?**

- "The signer must sign `bytesToSign()`, not a digest of it; the node hashes internally." Passes.
- "PERA-4643 fixed the double-hash in the signing preimage." Fails. Unlookupable, and it says what
  happened rather than what is true.

## Never

- **Work-item references.** `PERA-1234`, `PQ-017`, `Task 8`, `M6 Task 2`. State the reason itself.
- **Change narration.** What a PR did, what landed when, what was deleted, renamed or retired, which
  version shipped it. That is git's job, and a list of deleted symbols is a list of things a reader
  cannot find.
- **Expiring status.** "Currently blocked on", "pending review", "phase 2 will", "not yet started".
  Measured timings, file counts, test counts: all drift, and a wrong number is worse than none.
- **Duplication.** If two files explain the same thing, one is the source and the other links to it.
  The copy is the one that will go stale.
- **Restating the code.** `// Set the loading state`. `@param address The address`. Section banner
  comments. "This hook does X" above `useX`.

## Do

- **Non-obvious rationale.** Why this approach over the obvious one.
- **Traps.** A workaround, a footgun, something that looks wrong but is right, something that breaks
  if changed. These are the highest-value sentences in the repo.
- **Constraints from outside.** What an upstream library, a node, or a platform forces on you.
- **Units, ranges, encodings** the type can't express.

A production incident that shaped the code is worth **one sentence of consequence**, not the story:

```
Bad:  We saw reports that swaps failed for some users. After investigation we
      found the fee was computed before the group was regrouped, which meant the
      grp field was stale. This was fixed by moving the call, and a test was
      added to make sure it does not regress.

Good: Regroup after assigning fees, never before: assignGroupID rewrites grp,
      so an earlier fee pass leaves every member's grp stale.
```

## Verify before you write

A doc that asserts a path, an export, a dependency or a behaviour is making a claim about the repo.
Check it. Docs are trusted precisely because nobody re-derives them, which is what makes a wrong one
expensive.

- Paths and symbols: confirm they exist. Prefer naming a file over citing a line number, which goes
  stale without any signal.
- Dependencies: read `package.json` and the lockfile, not the previous version of the doc.
- Numbers: if it drifts (test counts, timings, call sites), leave it out.

When revising an existing doc, treat every claim in it as unverified. The stalest sentences are the
ones nobody has questioned.

## Sizing

One line is the norm for a comment; three is a lot. Past that, the code likely needs restructuring,
or the explanation belongs in `docs/`.

`docs/` files aim under 400 lines. A decision record that earns its length can run over; a tour of
the codebase cannot.

## Where it goes

| Location          | Holds                                                 |
| ----------------- | ----------------------------------------------------- |
| `docs/`           | Overviews and decision records, for humans on demand  |
| `CLAUDE.md`       | Rules, loaded into every agent session, so kept dense |
| `.claude/skills/` | Step-by-step procedures, invoked on demand            |
| Module doc        | Why this file exists and the traps in it              |
| Inline comment    | Why this line is not what you would expect            |

## Before you finish

```sh
pnpm lint:docs
```

It fails on wrongness (a path that no longer exists, a dead link, a work-item reference) and reports
on length without failing. A genuine exception is recorded with its reason, on the line above:

```
<!-- doc-hygiene-ignore-next-line stale-path reason: written by CI at build time -->
```
