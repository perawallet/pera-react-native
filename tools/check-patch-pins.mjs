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
 * stakes are Credential Manager continuity relying-party scoping and
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

// Normalize CRLF up front so the line-oriented regexes below (anchored on \n)
// don't silently fail to match a Windows-checked-out file.
const source = readFileSync(workspaceFile, 'utf8').replace(/\r\n/g, '\n')

const sectionBody = name => {
    const match = source.match(
        new RegExp(`^${name}:\\n((?:[ \\t]+.*\\n|\\n)*)`, 'm'),
    )
    return match?.[1] ?? ''
}

// Key: optionally quoted, no colon/quote/space inside it (so a `- 'pkg'` list
// item, which has no trailing `:`, never matches). Value: optionally quoted,
// terminated by whitespace, a quote, or a `#` comment — so a quoted value
// isn't swallowed together with its wrapping quotes, and a trailing `# ...`
// comment doesn't get folded into it either.
const catalogVersions = new Map(
    [...sectionBody('catalog').matchAll(/^\s+["']?([^"':\s]+)["']?:\s*["']?([^\s"'#]+)["']?/gm)].map(
        m => [m[1], m[2]],
    ),
)

// Same key shape as above, but patchedDependencies keys are never quote-free
// by convention only — YAML doesn't require the quotes, so require the colon
// right after the (optionally quoted) key rather than requiring the quotes.
const patchKeys = [
    ...sectionBody('patchedDependencies').matchAll(/^\s+["']?([^"'\s]+?)["']?:\s/gm),
].map(m => m[1])

if (patchKeys.length === 0) {
    console.error(
        'no patchedDependencies keys found — the file may be empty, or the ' +
            'catalog:/patchedDependencies: section names may have changed; check ' +
            workspaceFile,
    )
    process.exit(1)
}

const failures = []
const skipped = []
for (const raw of patchKeys) {
    const at = raw.lastIndexOf('@')
    const name = raw.slice(0, at)
    const patchVersion = raw.slice(at + 1)
    const catalogVersion = catalogVersions.get(name)
    if (catalogVersion === undefined) {
        skipped.push(name)
        continue
    }
    if (catalogVersion !== patchVersion) {
        failures.push(
            `${name}: patch pins ${patchVersion} but catalog pins ${catalogVersion}`,
        )
    }
}

if (skipped.length > 0) {
    for (const name of skipped) {
        console.log(`(skipped, not catalog-pinned: ${name})`)
    }
}

if (failures.length > 0) {
    console.error('patchedDependencies out of sync with catalog:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
}

console.log('patchedDependencies agree with the catalog')
