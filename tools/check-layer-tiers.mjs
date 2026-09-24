/*
 Copyright 2022-2026 Pera Wallet, LDA
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
 * Holds the workspace to the tiers in docs/ARCHITECTURE.md, read from each
 * member's package.json (every dependency field, because a devDependency still
 * orders the turbo graph and a type-only import still needs a declared edge):
 *
 * - The bottom tier (`packages/config`, `packages/shared`) depends only on itself.
 * - `extensions/platform`, the contract, depends only on the bottom tier.
 * - Other `extensions/*` depend only on extensions and the bottom tier.
 * - Only apps and other transports depend on a hardware-wallet transport
 *   (`extensions/ledger-*` bar `ledger-shared`): the app registers them, so
 *   nothing that depends on the provider inherits the BLE/USB driver graph.
 * - Nothing under `packages/` or `extensions/` depends on an app.
 * - `packages/devtools` is build and test tooling, allowed anywhere as a devDependency.
 *
 * An allowlisted edge whose two ends still exist but no longer depend on each
 * other fails too, so a fixed exception cannot linger and quietly permit its
 * own return.
 *
 *   node tools/check-layer-tiers.mjs [repoRoot]
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot =
    process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..')

const BOTTOM_TIER = new Set(['packages/config', 'packages/shared'])
const CONTRACT = 'extensions/platform'
const TOOLING = 'packages/devtools'
const isTransport = dir =>
    dir.startsWith('extensions/ledger-') && dir !== 'extensions/ledger-shared'

// Keyed `from -> to` by workspace directory. Each reason says why the edge is
// tolerated and what removes it.
const ALLOWLIST = {
    'extensions/keystore-chrome -> packages/passkeys':
        'the Chrome keystore implements the KeystoreSigner port that packages/passkeys defines, through its dependency-free /webauthn subpath',
}

const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
]

const readMembers = () => {
    const members = new Map()
    for (const group of ['apps', 'packages', 'extensions']) {
        const groupDir = join(repoRoot, group)
        if (!existsSync(groupDir)) continue
        for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue
            const manifestPath = join(groupDir, entry.name, 'package.json')
            if (!existsSync(manifestPath)) continue
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
            members.set(manifest.name, { dir: `${group}/${entry.name}`, manifest })
        }
    }
    return members
}

const allowedTargets = from => {
    if (BOTTOM_TIER.has(from)) return dir => BOTTOM_TIER.has(dir)
    if (from === CONTRACT) return dir => BOTTOM_TIER.has(dir)
    if (isTransport(from)) {
        return dir => BOTTOM_TIER.has(dir) || dir.startsWith('extensions/')
    }
    if (from.startsWith('extensions/')) {
        return dir =>
            BOTTOM_TIER.has(dir) ||
            (dir.startsWith('extensions/') && !isTransport(dir))
    }
    if (from.startsWith('packages/')) {
        return dir =>
            dir.startsWith('packages/') ||
            (dir.startsWith('extensions/') && !isTransport(dir))
    }
    return () => true
}

const members = readMembers()
if (members.size === 0) {
    console.error(`no workspace members found under ${repoRoot}`)
    process.exit(1)
}

const violations = []
const usedAllowlist = new Set()

for (const { dir: from, manifest } of members.values()) {
    const isAllowed = allowedTargets(from)
    for (const field of DEPENDENCY_FIELDS) {
        for (const depName of Object.keys(manifest[field] ?? {})) {
            const target = members.get(depName)
            if (!target) continue
            const to = target.dir
            if (to === TOOLING && field === 'devDependencies') continue
            if (isAllowed(to)) continue
            const edge = `${from} -> ${to}`
            if (ALLOWLIST[edge]) {
                usedAllowlist.add(edge)
                continue
            }
            violations.push(`${edge} (${field})`)
        }
    }
}

const memberDirs = new Set([...members.values()].map(({ dir }) => dir))
const stale = Object.keys(ALLOWLIST).filter(edge => {
    const [from, to] = edge.split(' -> ')
    return memberDirs.has(from) && memberDirs.has(to) && !usedAllowlist.has(edge)
})

if (violations.length > 0 || stale.length > 0) {
    if (violations.length > 0) {
        console.error('dependencies that break the layer tiers (see docs/ARCHITECTURE.md):')
        for (const violation of violations) console.error(`  - ${violation}`)
    }
    if (stale.length > 0) {
        console.error('allowlisted edges that no longer exist; delete them from ALLOWLIST:')
        for (const edge of stale) console.error(`  - ${edge}`)
    }
    process.exit(1)
}

console.log(
    `layer tiers hold across ${members.size} workspace members (${usedAllowlist.size} allowlisted edges)`,
)
