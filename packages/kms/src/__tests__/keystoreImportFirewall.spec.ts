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

// Matches only the bare meta-package specifier. Two separate parts do that
// work: the trailing quote is what keeps `keystore-core` out (it hits `-`
// where a quote must be), while `react-native-keystore` never gets that far —
// the LEADING literal `@algorandfoundation/keystore` already fails at `r` vs
// `k`. Dropping the trailing quote would readmit `keystore-core` alone.
const META_IMPORT = /from\s+['"]@algorandfoundation\/keystore['"]/

const collectScannedFiles = (): Promise<string[]> =>
    fg(
        [
            'packages/*/src/**/*.{ts,tsx}',
            'extensions/*/src/**/*.{ts,tsx}',
            'apps/*/src/**/*.{ts,tsx}',
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
// Bumping past the pin is worse, not better: in canary.23 (the nearest copy on
// disk) it is a thin meta re-export that hard-depends on keystore-node, which
// in turn reaches native `@napi-rs/keyring` — an optionalDependency loaded
// lazily via `createRequire` in `dist/storage/keyring.js:34`, not a static
// import — and on keystore-web.
//
// `@algorandfoundation/react-native-keystore` is NOT banned. Since canary.18 it
// re-exports keystore-core wholesale (`dist/index.js:6` in the installed
// canary.19), so shared types come from one place on both the RN build and
// Vitest's node condition — its `exports` map declares no per-condition split.
// That applies to TYPES only: a value import of it still fails to load under
// node (it reaches react-native-mmkv), which is why sibling packages
// (`packages/passkeys`, `packages/migrate`, `extensions/provider`) `vi.mock` it
// rather than importing it for value.
//
// Accepted blind spots, none of them checked here: dynamic `await import()`,
// `require()`, and side-effect `import '…'` forms are all missed because the
// pattern anchors on `from`; so is anything outside a `*/src/**` root.
// Subpath imports are missed too, but the meta package's `exports` map declares
// only `"."`, so none can resolve for any consumer.
describe('keystore meta-package firewall', () => {
    it('is not imported outside the chrome extension port', async () => {
        const files = await collectScannedFiles()

        // Asserted per root, not on the whole set: `files.length > 0` stayed
        // green with `apps/` dropped entirely (2118 files), so it could not
        // catch a rename or removal of any single root.
        for (const root of ['/packages/', '/extensions/', '/apps/']) {
            expect(files.some(f => f.includes(root))).toBe(true)
        }

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
