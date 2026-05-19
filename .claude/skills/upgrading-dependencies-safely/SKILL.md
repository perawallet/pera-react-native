---
name: upgrading-dependencies-safely
description: Use when adopting a dependency version bump, fixing an `audit`/advisory finding, or batching multiple bumps into a branch — especially when the ecosystem (npm, PyPI, crates.io, RubyGems, etc.) is under active supply-chain attack. Defends against compromised maintainer accounts, fresh malicious releases, and stale-Dependabot-PR title traps.
---

# Upgrading Dependencies Safely

A version bump is two questions, not one:

1. **Is this version safe to install?** (supply-chain question)
2. **Is this version compatible with our code?** (migration question)

You answer both _before_ `<pkg-manager> install`. If either answer is no, the bump doesn't ship — it gets split, deferred, or declined. Don't paper over a failure by widening freshness windows, suppressing audit gates, or bypassing existing ignore lists.

## When to use

- Adopting one or more Dependabot/Renovate PRs
- Triaging a security advisory
- Fixing `pnpm audit` / `npm audit` / `cargo audit` / `pip-audit` findings
- Manually upgrading a dependency
- Any of the above during an active ecosystem attack (e.g. `shai-hulud`)

## When NOT to use

- First-time onboarding of a new dependency (use a supply-chain audit skill — different goal)
- Routine lockfile regenerations with no version change

## The five phases

```
Verify → Assess migration → Apply → Verify build → Handle audit
   ↓             ↓             ↓          ↓              ↓
 stop?        defer?         stop?      stop?         stop?
```

### Phase 1 — Per-package supply-chain verification

For every `package@version` you intend to add, **before any install**:

1. **Publish age**: confirm published > the repo's freshness window (e.g. 7d). If the repo has no freshness gate, default to 7d.
2. **Provenance attestations** (where supported — npm/PyPI have SLSA): prefer packages with provenance. If a prior version had provenance and the new one doesn't, that's a red flag.
3. **Maintainer continuity**: compare maintainer list at the new version vs the previous version. A new maintainer added near the release date is a red flag — investigate before adopting.
4. **Install scripts**: check for `postinstall` / `preinstall` / `prepare` (npm), `build.rs` (cargo), `setup.py` (pip). If present and unfamiliar, **pull the tarball and read the script** before installing. Don't trust the name.
5. **Advisory cross-check**: `<pkg-manager> audit` after install — but also check the package against current attack-window advisories (GitHub Security Advisories, Socket, OSV).

Failing any check stops the bump for that package. Don't continue to migration assessment until supply-chain clears.

### Phase 2 — Migration-shape assessment

Don't conflate "semver major" with "real migration." Tier by what the code actually does:

| Tier    | Signal                                                                                                              | Action                    |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Trivial | Patch / minor; zero code refs; or version-spec metadata change                                                      | Install + verify          |
| Shallow | Few import sites, no API surface change in changelog                                                                | Bundle in the same PR     |
| Deep    | Many import sites or API rename/removal/semantic change                                                             | **Split to its own PR**   |
| Decline | Drops platform support / native re-architecture / ecosystem incompatibility (e.g. ESM-only into a CJS-only runtime) | Don't adopt; document why |

Required checks:

- **Read the changelog.** Don't infer from the version number.
- **Grep the monorepo for actual API usage** of the package. A 30-file usage with simple `.parse` calls is shallow; a 30-file usage with removed APIs is deep.
- **Don't trust the reported `from→to` range from the PR title or the advisory.** Bump tools often report the _oldest transitive resolution_ as "from" — not the direct dependency. Always cross-check against the actual spec change (e.g. catalog / `package.json` / `Cargo.toml`).

### Phase 3 — Apply (without stacking installs)

When batching multiple bumps:

1. **Edit specs, not the lockfile**. Modify `package.json`, `pnpm-workspace.yaml` catalog, `Cargo.toml`, `requirements.in`, etc.
2. **Don't merge or cherry-pick bump branches** if there's more than one — their lockfiles will conflict catastrophically. Replay the spec edits, then let the resolver pick.
3. **Run `<pkg-manager> install` once** at the end of each logical group. Stacked installs make the lockfile diff unreviewable.
4. **Don't bypass existing safety gates.** If `minimumReleaseAge` (pnpm) / `--prefer-online` rules / `cargo audit deny` / similar block something, that's the gate working. Investigate; don't disable.

### Phase 4 — Verify

In this order:

```
<install> --frozen-lockfile     # lockfile consistent with specs
<audit>                         # supply-chain net below your install gate
<build / typecheck>             # API compatibility
<test>                          # behavioral compatibility
<targeted smoke>                # high-impact packages: run the one feature
```

If a test fails:

- **Run the failing package's tests in isolation.** Parallel test runners flake under load; per-package solo runs disambiguate "flake" from "real regression." Don't assume either way.
- If real: drop the offending bump, don't fix forward in a dep PR.

### Phase 5 — Handle audit findings

When `audit` reports a finding:

1. **Distinguish pre-existing from regression.** Run `audit` on the base branch first. Pre-existing findings can be fixed in the same PR (often welcomed) but not bundled silently.
2. **Prefer bumping the direct dep** over adding an override. Overrides drift from upstream and accumulate.
3. **If overriding** (transitive that won't update): pick the lowest patched version and verify _that_ version with Phase-1 checks. Don't override blind.
4. **If the patched version is too fresh for your freshness gate**: use the gate's exclude list (pnpm `minimumReleaseAgeExclude`, etc.) — but verify maintainer continuity for the patched version first. Exclude-listing a compromised release defeats the gate's purpose.

## Stop / rollback conditions

Don't rationalize past these:

- Maintainer/provenance check fails → drop the package
- Lockfile produces unresolvable peer-dep conflicts → drop the latest-added bump
- Build/test fails and the fix surface is > ~1 day → split that bump to its own PR
- Suspicious release timing or IOC hit → stop the whole branch, escalate, don't push

## Common mistakes

| Mistake                                                                        | Reality                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The PR title says 3.x→4.x, so it's a major migration"                         | Often the title's "from" is the oldest transitive resolution. The actual catalog/spec change may be a minor within the same major. **Check the spec diff, not the PR title.**      |
| "Semver major = real migration"                                                | Sometimes it's a packaging change (ESM-only, native module split) that's much worse than an API rename. Read the changelog.                                                        |
| "This bump touched a config file Dependabot didn't mention, so it's unrelated" | Bump may have surfaced a pre-existing inconsistency (e.g. catalog vs override mismatch). Don't paper over — fix in the same PR.                                                    |
| "Tests passed solo but failed in the full run, so the bump broke something"    | Often parallel-test flake, not regression. Re-run solo and side-by-side with the base branch.                                                                                      |
| "Audit only flags moderate — below our high threshold, ignore it"              | True for blocking the PR. But if you're already touching the lockfile, fix it. The freshness window + a clean audit is cheap insurance.                                            |
| "Override to the latest fresh version to clear the audit"                      | Latest fresh version may itself be compromised. Run Phase-1 checks on the override target. Use the security-patch exclude list if needed — but only after maintainer verification. |
| "I'll just add to the ignore list to make Dependabot stop bothering me"        | Ignore lists hide signal. Decline a PR by closing it; only add to ignore if the incompatibility is structural (e.g. ESM/CJS boundary).                                             |

## Per-ecosystem cheat sheet

| Action                     | npm/pnpm                                                                                               | cargo                                        | pip                                         | gem                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------- | -------------------- |
| View pkg metadata          | `pnpm view <pkg>@<ver>`                                                                                | `cargo info <pkg>`                           | `pip show <pkg>`                            | `gem info <pkg>`     |
| Publish time               | `pnpm view <pkg>@<ver> time`                                                                           | crates.io API / web                          | PyPI web                                    | rubygems.org         |
| Provenance                 | `pnpm view <pkg> dist.attestations`                                                                    | (none yet)                                   | `pip install --require-hashes` for SHA pins | (none)               |
| Maintainers                | `pnpm view <pkg>@<ver> maintainers`                                                                    | `cargo owner --list <pkg>`                   | PyPI maintainer page                        | `gem owner <pkg>`    |
| Install scripts (look for) | `scripts.{pre,post}install`, `scripts.prepare`                                                         | `build.rs`, `[package.metadata]` build hooks | `setup.py`, `pyproject.toml` build hooks    | `extconf.rb`         |
| Pin override (transitive)  | `pnpm.overrides` (root pkg.json) or `overrides:` (workspace yaml); npm `overrides`; yarn `resolutions` | `[patch.crates-io]`                          | constraints file                            | `Gemfile` direct dep |
| Audit                      | `pnpm audit --prod`                                                                                    | `cargo audit`                                | `pip-audit`                                 | `bundle audit`       |
| Freshness gate             | `minimumReleaseAge` (pnpm 10+)                                                                         | (none built-in)                              | (none built-in)                             | (none built-in)      |

For ecosystems without a built-in freshness gate, document a manual age check in the verification step.

## Quick checklist

Before opening / merging the bump PR:

- [ ] Every `package@version` ran through Phase-1 checks (publish age, provenance where supported, maintainer continuity, install scripts)
- [ ] Migration shape decided per package (trivial / shallow / deep / decline) — deep bumps split into their own PRs
- [ ] Lockfile produced by **one** clean install per logical group, not stacked
- [ ] `audit` / `pnpm audit` runs clean OR remaining findings are documented as pre-existing
- [ ] Build, full test, and targeted smoke for high-impact packages all pass
- [ ] No existing safety gate was disabled (freshness, audit level, ignore list)
- [ ] Stop conditions reviewed — if any fired, the offending package was dropped, not bypassed

## Notes for skill maintainers

This skill was authored from one observed session as the de-facto RED baseline (failure modes: misreading PR `from→to` as the real spec change, treating semver major as proxy for migration shape, missing pre-existing catalog/override mismatches that a bump surfaces). A fresh-agent pressure test against a synthetic multi-PR bump scenario is still pending — run that before considering the skill "verified."
