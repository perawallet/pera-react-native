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

// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import fg from 'fast-glob'

const REPO = process.cwd().replace(/\/(packages|apps|extensions)\/.*$/, '')

// Custody now lives in the keystore: it derives and seals the Falcon private
// key itself and signs internally. These names describe the design that
// replaced, and a comment that lies about where private keys live is worse
// than no comment at all.
const RETIRED = [
    /commitQuantumChildKey/,
    /storage\/quantum-child/,
    /signWithQuantumSeed/,
    /\bdecryptData\b/,
    /\bencryptData\b/,
]

// This file necessarily spells every retired name, so it must not scan itself.
const SELF = fileURLToPath(import.meta.url)

const findStaleReferences = (files: string[]): string[] =>
    files
        .filter(file => file !== SELF)
        .flatMap(file => {
            const source = readFileSync(file, 'utf8')
            return RETIRED.filter(pattern => pattern.test(source)).map(
                pattern => `${file} :: ${pattern}`,
            )
        })

// `extensions/keystore-chrome` is deliberately outside the glob: it is a
// canary.12 port, out of scope for this migration, and legitimately still owns
// its own sync `encryptData`/`decryptData` helpers of that vintage.
describe('no stale quantum-custody references', () => {
    it('leaves no mention of the pre-keystore custody design', async () => {
        const files = await fg(
            [
                'packages/*/src/**/*.ts',
                'apps/*/src/**/*.ts',
                'extensions/provider/src/**/*.ts',
            ],
            { cwd: REPO, absolute: true, ignore: ['**/dist/**'] },
        )

        // A rename of the workspace layout can't silently drop coverage.
        expect(files.length).toBeGreaterThan(0)
        expect(findStaleReferences(files)).toEqual([])
    })

    it('regression: the scan is not vacuous — a planted stale reference IS flagged', () => {
        const dir = mkdtempSync(join(tmpdir(), 'stale-custody-'))
        try {
            const stale = join(dir, 'stale.ts')
            writeFileSync(
                stale,
                'const sig = await signWithQuantumSeed(seedId, payload)\n',
            )
            expect(findStaleReferences([stale])).toEqual([
                `${stale} :: /signWithQuantumSeed/`,
            ])
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })
})
