# CI Automation

Ticket bookkeeping and release publishing, both driven from GitHub Actions.

Bitrise builds, GitHub automates. Bitrise holds no Linear credential. "A release
shipped" is read from the check run Bitrise's GitHub integration already posts, so
the Linear rules live in one place and a Bitrise config change cannot silently stop
moving tickets.

## Ticket lifecycle

Keys are parsed from branch names, PR titles and commit subjects. Only Linear keys
of the Pera team (`PER-<digits>`) count, and only at a word boundary, so `pera-`
branches, retired Jira `PERA-` keys and words like `super-12` are ignored.

| When                                 | Target state   | Also                  | Workflow                  |
| ------------------------------------ | -------------- | --------------------- | ------------------------- |
| Ticket branch first pushed           | In Progress    |                       | `linear-sync.yml`         |
| PR opened non-draft, or marked ready | In Code Review |                       | `linear-sync.yml`         |
| PR merged to `main`                  | In QA          | assigned to Eric (QA) | `linear-sync.yml`         |
| Store (`vX.Y.Z`) shipped green       | Done           | only from In QA       | `linear-release-sync.yml` |

Only branch creation moves a ticket to In Progress; pushing review fixes to an
open PR would otherwise drag it back out of In Code Review. A store release covers
every commit since the previous store release; nightly and rc builds move nothing.

Linear's built-in GitHub automations for the team must stay off, or both will move
the same issue.

## Release publishing

Only stable `vX.Y.Z` tags get a GitHub Release. Nightly (`-alpha.N`) and rc
(`-rc.N`) tags exist to fire Bitrise's release builds; they are tagged but never
published under Releases.

| Tag source                               | Who publishes the GitHub Release            |
| ---------------------------------------- | ------------------------------------------- |
| `release-nightly.yml` / `release-rc.yml` | nobody (prerelease, tag only)               |
| `release-stable.yml`                     | itself, in the same job                     |
| Hand-pushed stable `vX.Y.Z`              | `release-publish.yml` (`push: tags`)        |
| Any older stable, after the fact         | `release-publish.yml` (`workflow_dispatch`) |

`release-stable.yml` publishes its own release rather than leaving it to
`release-publish.yml` because a tag pushed with `GITHUB_TOKEN` does not trigger
further workflows, so that workflow's `push: tags` trigger never fires for it.

The stable-only rule lives in `tools/release/publish-github-release.sh`, not in the
workflow, so every route to it agrees: hand-pushing a prerelease tag or
dispatching one by name skips just as the scheduled path does. Pinned by
`tools/__tests__/publish-github-release.test.sh`.

## Safety rules

What keeps the automation from damaging a live tracker.

| Rule                       | Effect                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Forward-only               | A ticket only ever moves up the pipeline; a later commit citing a tested key cannot reopen it |
| Off-pipeline is parked     | Blocked, Triage, Canceled and Duplicate are left alone                                        |
| Team-scoped                | An issue that has moved out of the `PER` team is left alone                                   |
| Commit mandatory           | Only tickets named in a commit are moved; ones that ship no code are moved by a person        |
| Never fails a build        | Every stage exits 0; problems surface as warning annotations                                  |
| Reads retry, writes do not | A timed-out write may already have applied server-side                                        |

Forward-only ranks the team's own states by type (backlog, unstarted, started,
completed), then board position, so the board's column order is the pipeline
order. Blocked is parked by name: Linear types it as started and places it after
In QA, so a rank would read it as past In QA.

`DRY_RUN=1` makes any stage read and report while withholding every write.

## Scripts

| Script                                    | Owns                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| `tools/linear-sync.sh`                    | every write to Linear: state moves and assignee        |
| `tools/release/tickets.sh`                | which tickets a tag delivered                          |
| `tools/release/previous-release-tag.sh`   | previous tag on the same channel, no fallback          |
| `tools/release/range-start.sh`            | the above plus the prerelease-only fallback            |
| `tools/release/publish-github-release.sh` | idempotent GitHub Release creation                     |
| `tools/release/promote-rc-tag.sh`         | resolving an rc and tagging its commit as stable       |
| `tools/release/cap-changelog.sh`          | keeping the Slack card under the 3000-char block limit |
| `tools/qa/smoke-verdict.sh`               | the pass/fail verdict for a finished Robot smoke run   |

`alpha` and `rc` interleave on `main`, so ranges are always per-channel: an
unrestricted `git describe` would diff a Friday RC against Thursday's nightly.

## Configuration

Repository secret: `LINEAR_API_KEY`, a personal API key of an account that can edit
`PER` issues. Without it every stage degrades to a warning and no writes. The team
key and QA assignee are in-repo values, so the flow needs no other setup. The
assignee is a Linear username (`displayName`), resolved to a user at run time;
zero or several active matches skip the assignment with a warning.

## Verifying changes

`tools/__tests__/*.test.sh` cover the sync, range and release-publishing logic,
against a stubbed Linear API or a throwaway git repo. The `CI Lint` job in
`ci-pre-merge.yml` runs `actionlint`, `shellcheck --severity=error`, and those
suites.

Run one locally with `bash tools/__tests__/linear-sync.test.sh`.

See also: [RELEASE.md](RELEASE.md) for store submission.
