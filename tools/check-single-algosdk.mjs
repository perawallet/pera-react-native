/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Asserts three things about `algosdk` across the workspace's own importers,
 * by inspecting `pnpm-lock.yaml` directly (no `pnpm list` shell-out — parsing
 * the lockfile is faster and doesn't require a fresh dependency-graph walk):
 *
 *   1. exactly one `algosdk` is resolved;
 *   2. it is a published registry release, not a tarball or an aliased fork;
 *   3. its version satisfies the `algosdk` range in the `catalog:` block of
 *      `pnpm-workspace.yaml` — the post-quantum floor.
 *
 * (2) and (3) matter because a build below the floor still resolves, installs
 * and type-checks; it just ships no `pqsig` field and no scheme-agnostic PQ
 * signer surface, so every quantum account silently loses the ability to sign.
 * (2) additionally rules out a fork drifting from upstream — one did, and it
 * signed a different preimage than the network verifies, which took a full
 * LocalNet debugging cycle to pin down.
 *
 * **Scope, precisely:** only the lockfile's `importers:` section — i.e. the
 * `algosdk` identities that workspace packages resolve to, including via
 * peer-dependency auto-install. It does NOT walk the `snapshots:`/`packages:`
 * sections, so a second `algosdk` reachable only transitively (nested inside
 * some third-party dependency's own tree, with no workspace importer resolving
 * to it) would not be reported here. That is deliberate: the failure mode this
 * guard exists for is a workspace package drifting off the shared resolution,
 * which is exactly an `importers:` fact.
 *
 * Why a single copy is load-bearing: pnpm's peer-dependency auto-install step
 * resolves an unmet peer (e.g. `@algorandfoundation/algokit-utils`'s `algosdk`
 * peer) by searching that importer's OWN dependency graph for an
 * already-resolved `algosdk` first. An importer that depends on
 * `algokit-utils` but never declares `algosdk` directly has no such instance
 * to find, and resolves a second copy of its own.
 *
 * There is deliberately no `overrides: algosdk:` entry any more — official
 * 3.7.0 satisfies algokit-utils' `^3.5.2` peer, so the catalog range alone
 * yields one copy. Both override forms this repo has used are still parsed, so
 * re-pinning stays a one-line change: a `file:` spec (a vendored build under
 * `libs/`) and an `npm:` alias to a differently-named package
 * (`@joe-p/algosdk`). Either form now trips assertion (2) above and would need
 * this gate updated deliberately — that friction is the point.
 *
 * This happened for real, mid-branch, on PERA-4653 (task 9's build gate
 * caught it): four packages drifted back to `algosdk@3.6.0` one commit after
 * a single resolution had been verified, breaking the app at a `pnpm build`
 * type-check boundary (`AlgoAmount` from two structurally distinct
 * `algokit-utils` instances doesn't satisfy itself). Two resolved copies of
 * `algosdk` also break `instanceof Transaction` / `instanceof Address`
 * checks and msgpack schema identity between `algokit-utils` and app code —
 * exactly the kind of bug that is miserable to diagnose from a bug report,
 * so this check runs on every `pnpm pre-push` rather than waiting for the
 * next full build to notice.
 *
 *   node tools/check-single-algosdk.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCKFILE_PATH = join(ROOT, 'pnpm-lock.yaml')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

/** Matches `algosdk@1.2.3`, `'algosdk@1.2.3'`, `@joe-p/algosdk@3.7.0-beta.1`,
 * `algosdk@file:libs/algosdk-3.7.0-beta.1.tgz`, etc. — any resolved-package
 * token whose name is exactly "algosdk" or ends in "/algosdk", immediately
 * followed by "@<version>". Deliberately does NOT
 * match plain `algosdk: ^3.5.2` peerDependency *declarations* (no `@version`
 * suffix directly on the name in those lines) or `algosdk: 3.6.0` specifier
 * lines in isolation — only tokens where the version is fused onto the name
 * with "@", which is how pnpm renders a *resolved* identity in peer suffixes
 * in parens and top-level `packages:` catalog keys.
 *
 * The version class admits ":" and "/" so a `file:` resolution is captured
 * whole. Truncating it at the colon would collapse every distinct tarball to
 * the same `algosdk@file` identity, which would compare equal to the expected
 * identity no matter which tarball was actually resolved. ")" is excluded, so
 * a peer suffix stops at its closing paren. The tarball's own FILENAME is not
 * matched: "algosdk" there is followed by "-", not "@".
 */
const ALGOSDK_IDENTITY_PATTERN =
    /(?:^|[^\w@/.-])((?:@[\w.-]+\/)?algosdk)@([\w.:/-]+)/g

/** Matches a direct `algosdk` dependency inside one importer block, capturing
 * its resolved `version:`. A `file:` resolution renders that field as a bare
 * `file:libs/...` — with no `algosdk@` prefix fused onto it — so the identity
 * pattern above cannot see it, and without this the guard would only observe
 * importers that happen to also pull algosdk in as an algokit-utils peer.
 */
const DIRECT_ALGOSDK_DEPENDENCY_PATTERN =
    /^ {6}algosdk:\n(?:^ {8}\S.*\n)*?^ {8}version: (.+)$/gm

/**
 * Normalizes an importer's resolved `version:` field into a full identity.
 *
 * An `npm:` alias override renders the aliased package's whole identity in that
 * field (`@joe-p/algosdk@3.7.0-beta.2`), while a registry or `file:` resolution
 * renders only the version (`3.6.0`, `file:libs/algosdk-3.7.0-beta.1.tgz`) and
 * needs the name prepended to be comparable with a peer suffix.
 */
function identityFromResolvedVersion(version) {
    const value = version
        .trim()
        .replace(/^['"]|['"]$/g, '')
        // `3.7.0(typescript@5.9.3)` -> `3.7.0`. algosdk declares no peers today,
        // but if it gained one the suffix would otherwise read as a non-registry
        // build and fail with a diagnosis pointing at a fork that doesn't exist.
        .replace(/\(.*\)$/, '')
    return /^(?:@[\w.-]+\/)?[\w.-]+@/.test(value) ? value : `algosdk@${value}`
}

/** Fails loudly with a one-line reason. Never returns. */
function fail(message) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
}

function readFileOrFail(path, label) {
    try {
        return readFileSync(path, 'utf8')
    } catch (error) {
        fail(`could not read ${label} at ${path}: ${error.message}`)
    }
}

/**
 * Extracts the identity pnpm-workspace.yaml's `overrides.algosdk` entry pins,
 * e.g. `npm:@joe-p/algosdk@3.7.0-beta.1` -> `@joe-p/algosdk@3.7.0-beta.1`, or
 * `file:./libs/algosdk-3.7.0-beta.1.tgz` ->
 * `algosdk@file:libs/algosdk-3.7.0-beta.1.tgz` (pnpm drops the leading `./`
 * when it renders the resolution).
 *
 * Returns `null` when `algosdk` has no override at all — the normal state,
 * where the catalog range alone governs. The identity comparison is then
 * skipped; the single-resolution, registry-release and catalog-range
 * assertions all still run.
 */
function findConfiguredAlgosdkIdentity(workspaceYaml) {
    const overridesBlock = extractTopLevelBlock(workspaceYaml, 'overrides')
    if (overridesBlock === null) return null
    const algosdkLine = overridesBlock
        .split('\n')
        .find(line => /^\s*algosdk:\s*/.test(line))
    if (!algosdkLine) return null
    const value = algosdkLine.replace(/^\s*algosdk:\s*/, '').trim()
    const unquoted = value.replace(/^['"]|['"]$/g, '')

    const npmAliasMatch = unquoted.match(/^npm:(.+)$/)
    if (npmAliasMatch) return npmAliasMatch[1]

    const fileSpecMatch = unquoted.match(/^file:(.+)$/)
    if (fileSpecMatch) return `algosdk@file:${fileSpecMatch[1].replace(/^\.\//, '')}`

    return null
}

/**
 * Returns the body of a top-level mapping key — every line indented under it.
 * Blank lines inside the block are kept; the block ends at the next line that
 * starts in column 0. `null` when the key is absent.
 */
function extractTopLevelBlock(yaml, key) {
    const headerMatch = yaml.match(new RegExp(`^${key}:[ \\t]*\\n`, 'm'))
    if (!headerMatch) return null
    const body = yaml.slice(headerMatch.index + headerMatch[0].length)
    const nextTopLevelMatch = body.match(/^\S/m)
    return nextTopLevelMatch ? body.slice(0, nextTopLevelMatch.index) : body
}

/**
 * Reads the `algosdk` range declared in pnpm-workspace.yaml's `catalog:` block.
 * That range is the post-quantum floor: below it the SDK has no `pqsig` field
 * and no scheme-agnostic PQ signer surface, so quantum accounts cannot sign.
 */
function findCatalogAlgosdkRange(workspaceYaml) {
    const catalogBlock = extractTopLevelBlock(workspaceYaml, 'catalog')
    if (catalogBlock === null) return null
    const algosdkLine = catalogBlock
        .split('\n')
        .find(line => /^\s+algosdk:\s*/.test(line))
    if (!algosdkLine) return null
    return algosdkLine
        .replace(/^\s*algosdk:\s*/, '')
        .replace(/\s+#.*$/, '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
}

/**
 * Parses `1.2.3` / `1.2.3-beta.1`. Returns `null` for anything that is not a
 * plain semver — which is how a `file:` tarball, a `link:` or an `npm:` alias
 * resolution is detected.
 */
function parseSemver(value) {
    const match = value.match(
        /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
    )
    if (!match) return null
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ?? null,
    }
}

/** `a < b` over the release triple. Prereleases are rejected before this runs. */
function isBelowVersion(a, b) {
    if (a.major !== b.major) return a.major < b.major
    if (a.minor !== b.minor) return a.minor < b.minor
    return a.patch < b.patch
}

/**
 * Accepts an exact `X.Y.Z` pin or a `^X.Y.Z` caret range — the two forms this
 * repo's catalogs use. Any other syntax fails loudly rather than quietly
 * passing: the whole
 * point of this gate is to catch a silent drop below the PQ floor, so a range
 * it cannot read must not be treated as satisfied.
 */
function satisfiesCatalogRange(version, range) {
    const exact = parseSemver(range)
    if (exact) {
        return (
            version.major === exact.major &&
            version.minor === exact.minor &&
            version.patch === exact.patch &&
            version.prerelease === exact.prerelease
        )
    }
    const caretMatch = range.match(/^\^(.+)$/)
    if (!caretMatch) {
        fail(
            `pnpm-workspace.yaml's catalog pins algosdk to '${range}', which this check only understands as an exact 'X.Y.Z' pin or a '^X.Y.Z' caret range. Teach tools/check-single-algosdk.mjs the new syntax rather than loosening the gate.`,
        )
    }
    const floor = parseSemver(caretMatch[1])
    if (!floor) {
        fail(
            `could not read '${range}' from the algosdk catalog entry as a caret range over a semver version.`,
        )
    }
    // A prerelease never satisfies a stable caret range, and we want it that
    // way here: a beta build is exactly what this gate was added to stop.
    if (version.prerelease) return false
    if (isBelowVersion(version, floor)) return false
    return floor.major > 0
        ? version.major === floor.major
        : version.major === 0 && version.minor === floor.minor
}

/**
 * Splits the `importers:` section of the lockfile into `{ name, body }`
 * blocks, one per workspace project (including the root `.` importer).
 */
function splitImportersSection(lockfileYaml) {
    const startMatch = lockfileYaml.match(/^importers:\n/m)
    if (!startMatch) {
        fail(
            "could not find a top-level 'importers:' section in pnpm-lock.yaml — lockfile format may have changed; refusing to assume a single algosdk resolution",
        )
    }
    const startIndex = startMatch.index + startMatch[0].length
    const nextTopLevelKeyMatch = lockfileYaml
        .slice(startIndex)
        .match(/^[a-zA-Z]/m)
    const endIndex = nextTopLevelKeyMatch
        ? startIndex + nextTopLevelKeyMatch.index
        : lockfileYaml.length
    const importersSection = lockfileYaml.slice(startIndex, endIndex)

    const importerHeaderPattern = /^ {2}(\S+):\n/gm
    const headers = [...importersSection.matchAll(importerHeaderPattern)]
    if (headers.length === 0) {
        fail(
            "found an 'importers:' section in pnpm-lock.yaml but no importer entries inside it — lockfile format may have changed; refusing to assume a single algosdk resolution",
        )
    }

    return headers.map((header, index) => {
        const name = header[1]
        const bodyStart = header.index + header[0].length
        const bodyEnd =
            index + 1 < headers.length
                ? headers[index + 1].index
                : importersSection.length
        return { name, body: importersSection.slice(bodyStart, bodyEnd) }
    })
}

function main() {
    const lockfileYaml = readFileOrFail(LOCKFILE_PATH, 'pnpm-lock.yaml')
    const workspaceYaml = readFileOrFail(WORKSPACE_PATH, 'pnpm-workspace.yaml')
    const expectedIdentity = findConfiguredAlgosdkIdentity(workspaceYaml)
    const catalogRange = findCatalogAlgosdkRange(workspaceYaml)

    const importers = splitImportersSection(lockfileYaml)

    /** @type {Map<string, Set<string>>} identity -> importer names referencing it */
    const identityToImporters = new Map()

    for (const { name, body } of importers) {
        const seenInThisImporter = new Set()
        for (const match of body.matchAll(ALGOSDK_IDENTITY_PATTERN)) {
            const identity = `${match[1]}@${match[2]}`
            seenInThisImporter.add(identity)
        }
        for (const match of body.matchAll(
            DIRECT_ALGOSDK_DEPENDENCY_PATTERN,
        )) {
            seenInThisImporter.add(identityFromResolvedVersion(match[1]))
        }
        for (const identity of seenInThisImporter) {
            if (!identityToImporters.has(identity)) {
                identityToImporters.set(identity, new Set())
            }
            identityToImporters.get(identity).add(name)
        }
    }

    if (identityToImporters.size === 0) {
        fail(
            "no 'algosdk' resolution found anywhere in pnpm-lock.yaml's importers section — algosdk is expected to be present workspace-wide; this almost certainly means the parser regex no longer matches the lockfile's format, not that algosdk was removed. Refusing to assume a pass.",
        )
    }

    if (identityToImporters.size > 1) {
        console.error(
            `FAIL: found ${identityToImporters.size} distinct resolved 'algosdk' packages across pnpm-lock.yaml's importers — this breaks cross-boundary 'instanceof Transaction'/'instanceof Address' checks and msgpack schema identity between @algorandfoundation/algokit-utils and app code.\n`,
        )
        for (const [identity, importerNames] of identityToImporters) {
            const flag =
                expectedIdentity && identity !== expectedIdentity
                    ? '  <-- UNEXPECTED (does not match the pnpm-workspace.yaml algosdk override)'
                    : ''
            console.error(`  ${identity}${flag}`)
            for (const importerName of [...importerNames].sort()) {
                console.error(`    - ${importerName}`)
            }
        }
        console.error(
            '\nFix: add "algosdk": "catalog:" as a direct dependency in each offending',
        )
        console.error(
            "package.json listed above (mirroring packages/blockchain's own",
        )
        console.error(
            'dependencies), then run `pnpm install` and re-run this check.',
        )
        process.exit(1)
    }

    const [[onlyIdentity, onlyImporters]] = identityToImporters
    if (expectedIdentity && onlyIdentity !== expectedIdentity) {
        fail(
            `the single resolved 'algosdk' package is '${onlyIdentity}', but pnpm-workspace.yaml's overrides pin it to '${expectedIdentity}' — the alias is not taking effect anywhere. Referenced by: ${[...onlyImporters].sort().join(', ')}.`,
        )
    }

    if (!catalogRange) {
        fail(
            "pnpm-workspace.yaml's catalog declares no 'algosdk' entry, so there is no post-quantum floor to check the resolution against. Restore it rather than removing this gate.",
        )
    }

    const resolvedVersion = onlyIdentity.startsWith('algosdk@')
        ? parseSemver(onlyIdentity.slice('algosdk@'.length))
        : null
    if (!resolvedVersion) {
        fail(
            `the single resolved 'algosdk' is '${onlyIdentity}', which is not a published registry release. A vendored tarball or an aliased fork bypasses the catalog range entirely, and a fork that drifts from upstream signs a different preimage than the network verifies — that mismatch cost a full debugging cycle once already. Referenced by: ${[...onlyImporters].sort().join(', ')}.`,
        )
    }
    if (!satisfiesCatalogRange(resolvedVersion, catalogRange)) {
        fail(
            `the resolved 'algosdk' is '${onlyIdentity}', which does not satisfy the catalog range '${catalogRange}'. Below that floor the build ships no 'pqsig' field and no scheme-agnostic PQ signer surface, so quantum accounts silently lose the ability to sign.`,
        )
    }

    console.log(
        `OK: single 'algosdk' resolution across ${onlyImporters.size} importers — ${onlyIdentity} (satisfies catalog '${catalogRange}'${expectedIdentity ? ", matches pnpm-workspace.yaml override" : ''}).`,
    )
}

main()
