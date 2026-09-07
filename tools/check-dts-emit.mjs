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
 * Declaration emit runs through each package's own `tsconfig.build.json`, so the
 * two ways it can break are both silent:
 *
 * - A package with no build config, or a `build` script that never invokes tsc,
 *   publishes `dist/index.d.ts` in its `exports` and ships nothing there. The
 *   consumer sees an untyped import, not an error.
 * - A brace glob in `exclude` matches nothing. tsconfig supports `*`, `?` and
 *   recursive wildcards but NOT `{a,b}`, and ignores what it cannot parse
 *   rather than complaining — so a brace pattern written to keep the MSW
 *   handlers out publishes them instead.
 *
 *   node tools/check-dts-emit.mjs [repoRoot]
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot =
    process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..')

const readJsonc = file =>
    JSON.parse(
        readFileSync(file, 'utf8')
            .replace(/^\s*\/\/.*$/gm, '')
            .replace(/,(\s*[}\]])/g, '$1'),
    )

const packageDirs = ['packages', 'extensions'].flatMap(group => {
    const groupDir = join(repoRoot, group)
    if (!existsSync(groupDir)) return []
    return readdirSync(groupDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(groupDir, entry.name))
})

const failures = []
let checked = 0

for (const dir of packageDirs) {
    const manifestPath = join(dir, 'package.json')
    if (!existsSync(manifestPath)) continue

    const manifest = readJsonc(manifestPath)
    // Only packages that actually publish declarations from a vite build.
    if (!existsSync(join(dir, 'vite.config.ts'))) continue
    if (!JSON.stringify(manifest.exports ?? manifest.types ?? '').includes('.d.ts')) continue

    const name = manifest.name ?? dir
    checked += 1

    const buildConfig = join(dir, 'tsconfig.build.json')
    if (!existsSync(buildConfig)) {
        failures.push(`${name}: publishes .d.ts but has no tsconfig.build.json`)
        continue
    }

    if (!(manifest.scripts?.build ?? '').includes('tsc -p tsconfig.build.json')) {
        failures.push(`${name}: build script never runs tsc -p tsconfig.build.json`)
    }

    const config = readJsonc(buildConfig)
    if (!config.compilerOptions?.rootDir) {
        failures.push(`${name}: tsconfig.build.json sets no rootDir (tsc refuses to emit)`)
    }
    for (const pattern of config.exclude ?? []) {
        if (/[{}]/.test(pattern)) {
            failures.push(`${name}: exclude pattern '${pattern}' uses a brace glob, which tsconfig ignores`)
        }
    }
}

if (checked === 0) {
    console.error(`no declaration-publishing packages found under ${repoRoot}`)
    process.exit(1)
}

if (failures.length > 0) {
    console.error('declaration emit is not wired correctly:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
}

console.log(`declaration emit wired for all ${checked} publishing packages`)
