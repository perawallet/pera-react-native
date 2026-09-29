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

import { resolve } from 'node:path'
import { build, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'
import {
    createExternal,
    defineLibraryConfig,
    packageNameOf,
} from '../library.js'

const fixtureRoot = resolve(__dirname, 'fixtures/library')

const manifest = {
    name: 'fixture-library',
    dependencies: { 'declared-dep': '1.0.0' },
    peerDependencies: { '@scope/peer': '1.0.0' },
    devDependencies: { 'dev-only': '1.0.0' },
}

const buildFixture = async (bundled: string[] = []) => {
    const config = defineLibraryConfig({
        root: fixtureRoot,
        entry: resolve(fixtureRoot, 'src/index.js'),
        fileName: 'index',
        bundled,
        build: { write: false },
    })
    const output = (await build({
        ...config,
        configFile: false,
        logLevel: 'silent',
        root: fixtureRoot,
    })) as Rolldown.RolldownOutput[]
    return output[0].output[0].code
}

describe('packageNameOf', () => {
    it('strips subpaths from plain and scoped specifiers', () => {
        expect(packageNameOf('zustand/middleware')).toBe('zustand')
        expect(packageNameOf('@noble/hashes/sha2.js')).toBe('@noble/hashes')
        expect(packageNameOf('algosdk')).toBe('algosdk')
    })
})

describe('createExternal', () => {
    const external = createExternal({
        manifest,
        extra: ['react-native', /^virtual:/],
    })

    it('externalizes dependencies and peers including deep subpaths', () => {
        expect(external('declared-dep')).toBe(true)
        expect(external('declared-dep/sub/path.js')).toBe(true)
        expect(external('@scope/peer')).toBe(true)
        expect(external('@scope/peer/deep')).toBe(true)
    })

    it('externalizes node builtins with and without the node: prefix', () => {
        expect(external('crypto')).toBe(true)
        expect(external('node:crypto')).toBe(true)
        expect(external('fs/promises')).toBe(true)
    })

    it('externalizes extra specifiers and patterns', () => {
        expect(external('react-native')).toBe(true)
        expect(external('virtual:thing')).toBe(true)
    })

    it('leaves devDependencies, undeclared packages and paths to the bundler', () => {
        expect(external('dev-only')).toBe(false)
        expect(external('undeclared')).toBe(false)
        expect(external('declared-dep-lookalike')).toBe(false)
        expect(external('./local.js')).toBe(false)
        expect(external('/abs/node_modules/declared-dep/index.js')).toBe(false)
    })

    it('does not externalize a dependency listed as bundled', () => {
        const withBundled = createExternal({
            manifest,
            bundled: ['declared-dep'],
        })

        expect(withBundled('declared-dep')).toBe(false)
        expect(withBundled('@scope/peer')).toBe(true)
    })
})

describe('defineLibraryConfig', () => {
    it('fails the build when a module outside the package would be inlined', async () => {
        await expect(buildFixture()).rejects.toThrow(
            /fixture-library would inline fixture-sibling into dist/,
        )
    })

    it('keeps declared deps and builtins as imports and allows opted-in inlining', async () => {
        const code = await buildFixture(['fixture-sibling'])

        expect(code).toMatch(/from\s*["']declared-dep["']/)
        expect(code).toMatch(/from\s*["']@scope\/peer\/deep\/path\.js["']/)
        expect(code).toMatch(/from\s*["']node:crypto["']/)
        expect(code).toContain('"sibling"')
    })
})
