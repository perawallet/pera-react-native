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
 * Every `patchedDependencies` key embeds an exact version. If the catalog moves
 * and the key does not, pnpm throws UNUSED_PATCH at install time — correct, but
 * only once someone runs a full install. This guard catches the same mistake in
 * a lint job with no network and no node_modules, so a drifted patch is caught
 * at review rather than after checkout. For the passkey-autofill patch the
 * stakes are Credential Manager continuity, PERA-4714 relying-party scoping and
 * the Rocca-Wallet string overrides.
 *
 *   node tools/check-patch-pins.mjs [pnpm-workspace.yaml]
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceFile =
    process.argv[2] ??
    join(dirname(fileURLToPath(import.meta.url)), '..', 'pnpm-workspace.yaml')

const source = readFileSync(workspaceFile, 'utf8')

const sectionBody = name => {
    const match = source.match(
        new RegExp(`^${name}:\\n((?:[ \\t]+.*\\n|\\n)*)`, 'm'),
    )
    return match?.[1] ?? ''
}

const catalogVersions = new Map(
    [...sectionBody('catalog').matchAll(/^\s+["']?([^"':\s]+)["']?:\s*(\S+)\s*$/gm)].map(
        m => [m[1], m[2]],
    ),
)

const failures = []
for (const match of sectionBody('patchedDependencies').matchAll(/^\s+["']([^"']+)["']:/gm)) {
    const raw = match[1]
    const at = raw.lastIndexOf('@')
    const name = raw.slice(0, at)
    const patchVersion = raw.slice(at + 1)
    const catalogVersion = catalogVersions.get(name)
    if (catalogVersion === undefined) continue
    if (catalogVersion !== patchVersion) {
        failures.push(
            `${name}: patch pins ${patchVersion} but catalog pins ${catalogVersion}`,
        )
    }
}

if (failures.length > 0) {
    console.error('patchedDependencies out of sync with catalog:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
}

console.log('patchedDependencies agree with the catalog')
