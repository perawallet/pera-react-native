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
 * Asserts that exactly one `algosdk` package is resolved across the
 * workspace's own importers, by inspecting `pnpm-lock.yaml` directly (no
 * `pnpm list` shell-out — parsing the lockfile is faster and doesn't require a
 * fresh dependency-graph walk).
 *
 * **Scope, precisely:** only the lockfile's `importers:` section — i.e. the
 * `algosdk` identities that workspace packages resolve to, including via
 * peer-dependency auto-install. It does NOT walk the `snapshots:`/`packages:`
 * sections, so a second `algosdk` reachable only transitively (nested inside
 * some third-party dependency's own tree, with no workspace importer resolving
 * to it) would not be reported here. That is deliberate: the failure mode this
 * guard exists for is a workspace package drifting off the override, which is
 * exactly an `importers:` fact.
 *
 * Why this exists: the workspace pins `algosdk` to Joe Polny's PQ-capable
 * fork via a bare-name `overrides: algosdk: 'npm:@joe-p/algosdk@...'` entry
 * in `pnpm-workspace.yaml` (see that file's `SWAP-BACK:` comment). That
 * override is NOT reliably honored for every importer: pnpm's peer-dependency
 * auto-install step resolves an unmet peer (e.g. `@algorandfoundation/
 * algokit-utils`'s `algosdk` peer) by searching that importer's OWN
 * dependency graph for an already-resolved `algosdk` instance first — an
 * importer that depends on `algokit-utils` but never declares `algosdk`
 * directly has no such instance to find, and the override is silently
 * bypassed, landing on stock `algosdk` from the registry instead of the fork.
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
 * etc. — any resolved-package token whose name is exactly "algosdk" or ends
 * in "/algosdk", immediately followed by "@<version>". Deliberately does NOT
 * match plain `algosdk: ^3.5.2` peerDependency *declarations* (no `@version`
 * suffix directly on the name in those lines) or `algosdk: 3.6.0` specifier
 * lines in isolation — only tokens where the version is fused onto the name
 * with "@", which is how pnpm renders a *resolved* identity everywhere
 * (import block `version:` fields, peer suffixes in parens, and the
 * top-level `packages:` catalog keys).
 */
const ALGOSDK_IDENTITY_PATTERN =
    /(?:^|[^\w@/.-])((?:@[\w.-]+\/)?algosdk)@([\w.-]+)/g

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
 * Extracts the alias target pnpm-workspace.yaml's `overrides.algosdk` entry
 * points at, e.g. `npm:@joe-p/algosdk@3.7.0-beta.1` -> `@joe-p/algosdk@3.7.0-beta.1`.
 * Returns `null` if there's no override configured for `algosdk` (in which
 * case the check still runs, just without an "expected identity" to compare
 * against — it can still catch a lockfile with more than one resolution).
 */
function findConfiguredAlgosdkAlias(workspaceYaml) {
    const overridesBlockMatch = workspaceYaml.match(
        /^overrides:\n((?:^[ \t]+.*\n?)*)/m,
    )
    if (!overridesBlockMatch) return null
    const overridesBlock = overridesBlockMatch[1]
    const algosdkLine = overridesBlock
        .split('\n')
        .find(line => /^\s*algosdk:\s*/.test(line))
    if (!algosdkLine) return null
    const value = algosdkLine.replace(/^\s*algosdk:\s*/, '').trim()
    const unquoted = value.replace(/^['"]|['"]$/g, '')
    const npmAliasMatch = unquoted.match(/^npm:(.+)$/)
    return npmAliasMatch ? npmAliasMatch[1] : null
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
    const expectedIdentity = findConfiguredAlgosdkAlias(workspaceYaml)

    const importers = splitImportersSection(lockfileYaml)

    /** @type {Map<string, Set<string>>} identity -> importer names referencing it */
    const identityToImporters = new Map()

    for (const { name, body } of importers) {
        const seenInThisImporter = new Set()
        for (const match of body.matchAll(ALGOSDK_IDENTITY_PATTERN)) {
            const identity = `${match[1]}@${match[2]}`
            seenInThisImporter.add(identity)
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

    console.log(
        `OK: single 'algosdk' resolution across ${onlyImporters.size} importers — ${onlyIdentity}${expectedIdentity ? ' (matches pnpm-workspace.yaml override)' : ''}.`,
    )
}

main()
