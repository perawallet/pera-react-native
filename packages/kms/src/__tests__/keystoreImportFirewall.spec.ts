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

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import fg from 'fast-glob'

// Matches only the bare meta-package specifier: the trailing quote inside the
// class is what keeps `keystore-core` and `react-native-keystore` out of it.
const META_IMPORT = /from\s+['"]@algorandfoundation\/keystore['"]/

const collectScannedFiles = (): Promise<string[]> =>
    fg(
        [
            'packages/*/src/**/*.ts',
            'extensions/*/src/**/*.ts',
            'apps/*/src/**/*.ts',
        ],
        {
            cwd: process.cwd().replace(/\/(packages|apps|extensions)\/.*$/, ''),
            absolute: true,
            ignore: ['**/extensions/keystore-chrome/**', '**/dist/**'],
        },
    )

// `@algorandfoundation/keystore` is pinned at 1.0.0-canary.17 (see
// pnpm-workspace.yaml): a pre-split, self-contained implementation with its own
// flat function API and its own key types — a second, frozen keystore universe
// beside keystore-core. keystore-chrome is built on it and is exempt; anywhere
// else it would mean two incompatible type universes for the same key data.
// Bumping past the pin is worse, not better: canary.18+ turned it into a thin
// meta re-export that hard-depends on keystore-node (native @napi-rs/keyring)
// and keystore-web.
//
// `@algorandfoundation/react-native-keystore` is NOT banned. Since canary.18 it
// re-exports keystore-core wholesale (`dist/index.js:6` in the installed
// canary.19), so shared types come from one place on both the RN build and
// Vitest's node condition — its `exports` map declares no per-condition split.
// That applies to TYPES only: a value import of it still fails to load under
// node (it reaches react-native-mmkv), which is why kms/src/index.ts keeps
// `installKMSKeystoreHooks` behind the /bootstrap entry.
describe('keystore meta-package firewall', () => {
    it('is not imported outside the chrome extension port', async () => {
        const files = await collectScannedFiles()

        // A rename of the scanned roots can't silently make this vacuous.
        expect(files.length).toBeGreaterThan(0)

        const offenders = files.filter(f =>
            META_IMPORT.test(readFileSync(f, 'utf8')),
        )
        expect(offenders).toEqual([])
    })

    it('does not ban react-native-keystore or keystore-core, only the bare meta-package', () => {
        expect(
            META_IMPORT.test(
                "import { openData } from '@algorandfoundation/react-native-keystore'",
            ),
        ).toBe(false)
        expect(
            META_IMPORT.test(
                "import type { Key } from '@algorandfoundation/keystore-core'",
            ),
        ).toBe(false)

        // Assembled rather than written as a literal: this spec is itself
        // inside the scanned set, so a literal meta import here would make the
        // guard above report its own source file.
        const meta = `@algorandfoundation/${'keystore'}`
        expect(META_IMPORT.test(`import { generateKey } from '${meta}'`)).toBe(
            true,
        )
    })

    it('positive control: a real in-repo react-native-keystore importer is scanned and is not an offender', async () => {
        const files = await collectScannedFiles()
        const realImporter = files.find(f =>
            f.endsWith(
                '/extensions/provider/src/keystore/migrations/sealing.ts',
            ),
        )

        // Proves the allowance is exercised against real source, not just the
        // regex: this file is inside the scan set AND imports the RN package.
        expect(realImporter).toBeDefined()
        const content = readFileSync(realImporter as string, 'utf8')
        expect(content).toMatch(
            /from\s+['"]@algorandfoundation\/react-native-keystore['"]/,
        )
        expect(META_IMPORT.test(content)).toBe(false)
    })
})
