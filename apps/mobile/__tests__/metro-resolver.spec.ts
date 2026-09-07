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
