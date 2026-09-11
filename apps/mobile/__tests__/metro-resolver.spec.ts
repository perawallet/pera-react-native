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

import { readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'
import metroConfig from '../metro.config'
import {
    asyncStorageUnavailable,
    createAsyncStorage,
    useAsyncStorage,
} from '../metro-shims/async-storage'

const ASYNC_STORAGE = '@react-native-async-storage/async-storage'

const STUB_PATH = path.resolve(__dirname, '../metro-shims/async-storage.ts')

type Resolution = { type: string; filePath: string }

type ResolverContext = {
    resolveRequest: (
        context: ResolverContext,
        moduleName: string,
        platform: string | null,
    ) => Resolution
}

type Resolver = (
    context: ResolverContext,
    moduleName: string,
    platform: string | null,
) => Resolution

// metro.config.js is untyped JS; the resolver is reached the way Metro reaches
// it, through the exported config.
const { resolveRequest } = metroConfig.resolver as unknown as {
    resolveRequest: Resolver
}

const FELL_THROUGH: Resolution = {
    type: 'sourceFile',
    filePath: '/fell-through',
}

const makeContext = (): ResolverContext => ({
    resolveRequest: vi.fn(() => FELL_THROUGH),
})

describe('metro resolver: AsyncStorage', () => {
    it.each(['ios', 'android', 'web'])(
        'resolves the package to the throwing stub on %s',
        platform => {
            const context = makeContext()

            const resolved = resolveRequest(context, ASYNC_STORAGE, platform)

            expect(resolved).toEqual({
                type: 'sourceFile',
                filePath: STUB_PATH,
            })
            expect(context.resolveRequest).not.toHaveBeenCalled()
        },
    )

    it('redirects deep imports to the stub as well', () => {
        const resolved = resolveRequest(
            makeContext(),
            `${ASYNC_STORAGE}/jest/async-storage-mock`,
            'ios',
        )

        expect(resolved.filePath).toBe(STUB_PATH)
    })

    // The mapping above is only worth anything while something in the graph
    // still asks. WalletConnect v2 is what put the specifier there: the v2
    // handler imports `@walletconnect/core`, which depends on
    // `@walletconnect/keyvaluestorage` even when a custom `storage` is
    // supplied, and that package's react-native entry requires AsyncStorage at
    // module scope. If the SDK ever drops or renames it, this fails rather
    // than leaving a dead mapping and an unexplained stub behind.
    it('is asked for by the WalletConnect v2 graph, and that request lands on the stub', () => {
        const requireFromPackage = createRequire(
            path.resolve(__dirname, '../../../packages/walletconnect/index.js'),
        )
        const requireFromCore = createRequire(
            requireFromPackage.resolve('@walletconnect/core'),
        )
        const manifestPath = requireFromCore.resolve(
            '@walletconnect/keyvaluestorage/package.json',
        )
        const manifest: { 'react-native': string } = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        )
        const nativeEntry = readFileSync(
            path.resolve(path.dirname(manifestPath), manifest['react-native']),
            'utf8',
        )

        expect(nativeEntry).toContain(`require("${ASYNC_STORAGE}")`)
        expect(
            resolveRequest(makeContext(), ASYNC_STORAGE, 'ios').filePath,
        ).toBe(STUB_PATH)
    })

    it('leaves a similarly named package alone', () => {
        const context = makeContext()

        const resolved = resolveRequest(
            context,
            '@react-native-async-storage/async-storage-extra',
            'ios',
        )

        expect(resolved).toBe(FELL_THROUGH)
        expect(context.resolveRequest).toHaveBeenCalled()
    })
})

describe('metro resolver: tslib', () => {
    const resolvingTo = (filePath: string): ResolverContext => ({
        resolveRequest: vi.fn(() => ({ type: 'sourceFile', filePath })),
    })

    const TSLIB_1 =
        '/repo/node_modules/.pnpm/tslib@1.14.1/node_modules/tslib/modules/index.js'
    const TSLIB_2 =
        '/repo/node_modules/.pnpm/tslib@2.8.1/node_modules/tslib/tslib.es6.mjs'

    it.each([
        ['the 1.x ESM wrapper', TSLIB_1],
        ['the 2.x ESM build', TSLIB_2],
    ])('redirects %s to the CJS build', (_label, filePath) => {
        const resolved = resolveRequest(resolvingTo(filePath), 'tslib', 'ios')

        expect(resolved).toEqual({
            type: 'sourceFile',
            filePath: path.resolve(
                filePath.replace(/(modules\/index\.js|tslib\.es6\.mjs)$/, ''),
                'tslib.js',
            ),
        })
    })

    it('leaves an already-CJS resolution alone', () => {
        const filePath =
            '/repo/node_modules/.pnpm/tslib@1.14.1/node_modules/tslib/tslib.js'

        expect(resolveRequest(resolvingTo(filePath), 'tslib', 'ios')).toEqual({
            type: 'sourceFile',
            filePath,
        })
    })

    it('leaves tslib subpath imports alone', () => {
        const context = makeContext()

        expect(resolveRequest(context, 'tslib/modules/index.js', 'ios')).toBe(
            FELL_THROUGH,
        )
        expect(context.resolveRequest).toHaveBeenCalled()
    })

    // The redirect only earns its place while tslib still ships that exports
    // map and something in the graph still asks for it as CJS. Both halves are
    // asserted here so a tslib release that drops the `import` branch fails
    // this test rather than leaving an unexplained redirect behind.
    it('is still needed: tslib prefers its ESM entry and a CJS consumer asks for it', () => {
        const requireFromCore = createRequire(
            createRequire(
                path.resolve(
                    __dirname,
                    '../../../packages/walletconnect/index.js',
                ),
            ).resolve('@walletconnect/core'),
        )
        const consumer = requireFromCore.resolve(
            '@walletconnect/jsonrpc-utils/package.json',
        )
        // tslib's own exports map doesn't expose ./package.json, so reach the
        // package root through the entry Node picks (the CJS one).
        const tslibRoot = path.dirname(createRequire(consumer).resolve('tslib'))
        const { exports: map } = JSON.parse(
            readFileSync(path.join(tslibRoot, 'package.json'), 'utf8'),
        ) as { exports: Record<string, Record<string, unknown>> }

        // Metro matches conditions in map order, so `import` winning over
        // `default` is the whole failure mode.
        const conditions = Object.keys(map['.'])
        expect(conditions.indexOf('import')).toBeLessThan(
            conditions.indexOf('default'),
        )

        const wrapper = readFileSync(
            path.join(tslibRoot, 'modules/index.js'),
            'utf8',
        )
        expect(wrapper).toContain("import tslib from '../tslib.js'")

        expect(
            resolveRequest(
                resolvingTo(path.join(tslibRoot, 'modules/index.js')),
                'tslib',
                'ios',
            ).filePath,
        ).toBe(path.join(tslibRoot, 'tslib.js'))
    })
})

describe('AsyncStorage stub', () => {
    it.each(Object.keys(asyncStorageUnavailable))(
        'throws from %s rather than pretending to store anything',
        member => {
            const store: Record<string, () => unknown> = asyncStorageUnavailable

            expect(() => store[member]()).toThrow(/not available in Pera/i)
        },
    )

    it('throws from the v3 factory and hook entry points', () => {
        expect(() => createAsyncStorage()).toThrow(/not available in Pera/i)
        expect(() => useAsyncStorage()).toThrow(/not available in Pera/i)
    })
})
