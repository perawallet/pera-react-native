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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const keystoreClearMock = vi.hoisted(() => vi.fn())

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    clear: keystoreClearMock,
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@tanstack/store', () => ({
    Store: class {
        constructor() {}
    },
}))

vi.mock('before-after-hook', () => ({
    default: {
        Collection: class {
            constructor() {}
        },
    },
}))

import {
    getProvider,
    getKeystoreStore,
    getKeystoreHooks,
    initializeProvider,
    resetProvider,
    clearKeystore,
} from '../singleton'
import { PeraProvider } from '../pera-provider'

describe('provider singleton', () => {
    beforeEach(() => {
        keystoreClearMock.mockReset()
    })

    test('exposes the default PeraProvider before any reinitialization', () => {
        const provider = getProvider()
        expect(provider).toBeInstanceOf(PeraProvider)
    })

    test('resetProvider clears the instance and getProvider then throws', () => {
        resetProvider()
        expect(() => getProvider()).toThrow(/Provider not initialized/)
    })

    test('initializeProvider sets the instance once and rejects reinitialization', () => {
        resetProvider()
        const dummy = new PeraProvider({ id: 'x', name: 'X' })
        initializeProvider(dummy)

        expect(getProvider()).toBe(dummy)
        expect(() => initializeProvider(dummy)).toThrow(
            /Provider already initialized/,
        )
    })

    test('clearKeystore delegates to the native keystore clear', async () => {
        keystoreClearMock.mockResolvedValue(undefined)

        await clearKeystore()

        expect(keystoreClearMock).toHaveBeenCalledWith(
            expect.objectContaining({ store: expect.any(Object) }),
        )
    })

    test('getKeystoreStore returns the same TanStack Store instance the keystore extension was wired with', () => {
        const store = getKeystoreStore()
        expect(store).toBeDefined()
        // Same instance across calls — must be a singleton so kms-side
        // subscriptions and the platform keystore agree on state.
        expect(getKeystoreStore()).toBe(store)
    })

    test('getKeystoreHooks returns the same Hook.Collection across calls', () => {
        const hooks = getKeystoreHooks()
        expect(hooks).toBeDefined()
        expect(getKeystoreHooks()).toBe(hooks)
    })
})
