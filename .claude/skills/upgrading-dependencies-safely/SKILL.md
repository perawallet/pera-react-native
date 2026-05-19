---
name: upgrading-dependencies-safely
description: Use when handling any dependency version change — Dependabot/Renovate PRs, advisory patches, manual bumps, audit fixes, override edits. Symptoms that mean STOP and load this skill — uncertain whether a bump tool's `from→to` reflects the actual spec change; deciding migration shape from a semver delta; about to classify a major as safe or a minor as breaking; about to add a transitive override or a freshness-window carveout. Applies during evaluation and triage, not only at install time. Heightened criticality during active supply-chain attacks (e.g. shai-hulud/npm).
---

# Upgrading Dependencies Safely

A version bump is two questions, not one:

1. **Is this version safe to install?** (supply-chain question)
2. **Is this version compatible with our code?** (migration question)

You answer both _before_ `<pkg-manager> install`. If either answer is no, the bump doesn't ship — it gets split, deferred, or declined. Don't paper over a failure by widening freshness windows, suppressing audit gates, or bypassing existing ignore lists.

## Read these first — most-missed traps

Even if you skim the rest, do not skip these. They are the failure modes that bite during evaluation, before any install:

- **The PR title's `from → to` is often a lie.** Bump tools (Dependabot, Renovate) commonly report the _oldest transitive resolution_ as "from" — not the direct dependency. A PR titled "bump zod from 3.25.76 to 4.4.3" may actually be a `^4.3.6 → ^4.4.3` minor change to the catalog/spec; the 3.x is just an unrelated transitive that the tool happened to surface. **Diff the actual spec file (`package.json`, `pnpm-workspace.yaml`, `Cargo.toml`, etc.) on the bump branch against base. The spec diff is the truth; the PR title is a hint.**
- **Semver major ≠ migration shape.** A `major` bump may be a trivial packaging change _or_ an API rewrite. A `minor` bump may be ESM-only / native-rebuild / drop-platform-support and break you. **Read the changelog before classifying the migration shape — never infer from the version number alone.**
- **A bump can surface pre-existing inconsistencies.** Overrides, catalogs, and ignore lists drift. A bump that pulls one version forward may expose a sibling pin that wasn't following along. **When something fails unexpectedly mid-bump, check whether the failing config predates the bump.**
- **A bump's spec diff that includes a _downgrade_ of an unrelated package is a flag, not an error.** Catalogs and overrides sometimes move backward as a side-effect — either to satisfy a peer-dep conflict surfaced by the main bump, or to align the spec with an existing ignore/policy (e.g. catalog `^2.0.1 → ^1.8.0` to honor an "ESM-only major is unadoptable" ignore rule). Don't reflexively undo a downgrade; trace _why_ it moved, document it in the PR, and verify it's not an accidental regression of someone else's work.
- **"Pre-existing" audit findings still count.** They don't block the PR, but if you're already touching the lockfile, fix them in the same PR. Just verify pre-existence first by running `audit` on the base branch.

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

Authored from one observed session as the de-facto RED baseline (failure modes: misreading PR `from→to` as the real spec change, treating semver major as proxy for migration shape, missing pre-existing catalog/override mismatches that a bump surfaces, adding freshness-window exclusions without verifying maintainer continuity).

Validated via two GREEN rounds of fresh-agent pressure testing:

- **Round 1 (Explore agent):** RED — skill not invoked. Agent rationalized "skills are for execution; this is research." Description was scoped to action verbs only.
- **Round 2 (Explore agent, broadened description):** RED — agent still rationalized "no skills strictly necessary for this research task." Verdicts hand-waved without spec-diff evidence.
- **Round 3 (default `claude` agent, symptom-driven description):** GREEN — agent invoked the skill at step 1, cited spec diffs for every verdict, caught all three "PR title lies" traps, identified the `react-native-nitro-image` peer-dep change in vision-camera v5, and surfaced the catalog-moved-backward pattern (which was added to the Red Flags section as a result).

If you re-tune this skill, re-run a fresh-agent pressure test — discoverability is fragile and easy to regress.
