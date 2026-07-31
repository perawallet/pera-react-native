# CI Automation

Ticket bookkeeping and release publishing, both driven from GitHub Actions.

**Bitrise builds; GitHub automates.** Bitrise holds no Jira credential. "A release
shipped" is read from the check run Bitrise's GitHub integration already posts, so
the Jira rules live in one place and a Bitrise config change cannot silently stop
moving tickets.

## Ticket lifecycle

Keys are parsed from branch names, PR titles and commit subjects — anything not
matching `PERA-<digits>` is ignored.

| When                                 | Target status  | Also                             | Workflow                |
| ------------------------------------ | -------------- | -------------------------------- | ----------------------- |
| Ticket branch first pushed           | In Progress    | —                                | `jira-sync.yml`         |
| PR opened non-draft, or marked ready | In Code Review | —                                | `jira-sync.yml`         |
| PR merged to `main`                  | In Code Review | assigned to QA                   | `jira-sync.yml`         |
| Nightly (`-alpha.N`) shipped green   | Ready for QA   | —                                | `jira-release-sync.yml` |
| RC (`-rc.N`) shipped green           | Ready for QA   | fix version stamped              | `jira-release-sync.yml` |
| Store (`vX.Y.Z`) shipped green       | Done           | only from Waiting for Deployment | `jira-release-sync.yml` |

Only branch creation moves a ticket to In Progress; pushing review fixes to an
open PR would otherwise drag it back out of In Code Review.

## Release publishing

| Tag source                       | Who publishes the GitHub Release           |
| -------------------------------- | ------------------------------------------ |
| `nightly-tag.yml` / `rc-tag.yml` | the minting job itself                     |
| Hand-pushed `v*`                 | `github-release.yml` (`push: tags`)        |
| Any older tag, after the fact    | `github-release.yml` (`workflow_dispatch`) |

A tag pushed with `GITHUB_TOKEN` does not trigger workflows, which is why the
minting jobs publish their own release rather than relying on the tag trigger.

## Safety rules

These are what keep automation from doing damage to a live tracker.

| Rule                       | Effect                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Forward-only               | A ticket only ever moves up the pipeline; a later commit citing a tested key cannot reopen it                      |
| Off-pipeline is parked     | Blocked, `*Input Needed`, Cancelled, Duplicate are left alone                                                      |
| Board-scoped               | Every candidate is confirmed against the React Native board filter, so a PR citing a Backend ticket cannot move it |
| Fails closed               | If the scope check itself fails, nothing is written                                                                |
| Commit mandatory           | Only tickets named in a commit are moved — tickets that ship no code are moved by a person                         |
| Never fails a build        | Every stage exits 0; problems surface as warning annotations                                                       |
| Fix version is first-wins  | An existing value is never overwritten                                                                             |
| Reads retry, writes do not | A timed-out write may already have applied server-side                                                             |

`DRY_RUN=1` makes any stage read and report while withholding every write.

## Drift report

Because every stage exits 0, a rotated token would stop moving tickets silently.
`jira-drift.yml` runs Mondays 08:00 UTC and **fails the run** when git and Jira
disagree — a red scheduled run is the notification. It is read-only, and reports
two low-noise cases: merged but never advanced (past a 48h grace), and shipped at
or past Waiting for Deployment with no fix version.

## Scripts

| Script                            | Owns                                                     |
| --------------------------------- | -------------------------------------------------------- |
| `tools/jira-sync.sh`              | every write to Jira — transitions, assignee, fix version |
| `tools/lib/jira-api.sh`           | auth, paging, retry policy, and the board filter default |
| `tools/jira-drift.sh`             | the read-only drift report                               |
| `tools/release-tickets.sh`        | which tickets a tag delivered                            |
| `tools/previous-release-tag.sh`   | previous tag on the same channel, no fallback            |
| `tools/release-range-start.sh`    | the above plus the prerelease-only fallback              |
| `tools/publish-github-release.sh` | idempotent GitHub Release creation                       |

`alpha` and `rc` interleave on `main`, so ranges are always per-channel: an
unrestricted `git describe` would diff a Friday RC against Thursday's nightly.

## Configuration

Repository secrets: `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`. A
missing one degrades to a warning and no writes. The board filter, project id and
QA assignee are in-repo values, not secrets — deliberately, so the flow needs no
out-of-band setup.

Creating fix versions needs _Administer Projects_; without it the run degrades to
skipping fix versions rather than failing.

## Verifying changes

`tools/__tests__/*.test.sh` cover the sync, drift and range logic against a
stubbed Jira. The `CI Lint` job in `pre-merge.yml` runs `actionlint`,
`shellcheck --severity=error`, and those suites.

Run one locally with `bash tools/__tests__/jira-sync.test.sh`.

See also: [RELEASE.md](RELEASE.md) for store submission.
