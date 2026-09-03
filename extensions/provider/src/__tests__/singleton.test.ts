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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const keystoreMocks = vi.hoisted(() => ({
    clear: vi.fn(),
    decode: vi.fn(),
    storageGetAllKeys: vi.fn(() => [] as string[]),
    storageGetString: vi.fn(),
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: () => ({
        ready: Promise.resolve(),
        clear: keystoreMocks.clear,
    }),
    decode: keystoreMocks.decode,
    METADATA_PREFIX: 'k/',
    storage: {
        getAllKeys: keystoreMocks.storageGetAllKeys,
        getString: keystoreMocks.storageGetString,
    },
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

// Minimal fake of @tanstack/store's Store for the singleton's keystoreStore
// instance. The singleton uses `state.keys` (read) and is mutated via
// `setState` — neither path needs real subscriptions.
vi.mock('@tanstack/store', () => ({
    Store: class {
        state: { keys: unknown[]; status: string }
        constructor(initial: { keys: unknown[]; status: string }) {
            this.state = { ...initial }
        }
        setState(
            updater: (prev: { keys: unknown[]; status: string }) => {
                keys: unknown[]
                status: string
            },
        ) {
            this.state = updater(this.state)
        }
    },
}))

vi.mock('before-after-hook', () => ({
    default: {
        Collection: class {
            constructor() {}
        },
    },
}))

import { memoryLedger } from '@algorandfoundation/provider-migrations'
import {
    getProvider,
    getKeystore,
    getKeystoreStore,
    getKeystoreHooks,
    initializeProvider,
    resetProvider,
    clearKeystore,
    reconcileKeystore,
} from '../singleton'
import { PeraProvider } from '../pera-provider'

const resetKeystoreStateForTest = (): void => {
    // The keystoreStore singleton is constructed once at module load. Reset
    // its `state.keys` between tests so one case's seeding doesn't leak into
    // the next.
    const store = getKeystoreStore() as unknown as {
        state: { keys: unknown[]; status: string }
    }
    store.state = { keys: [], status: 'idle' }
}

describe('provider singleton', () => {
    beforeEach(() => {
        keystoreMocks.clear.mockReset()
        keystoreMocks.decode.mockReset()
        keystoreMocks.storageGetAllKeys.mockReset()
        keystoreMocks.storageGetString.mockReset()
        keystoreMocks.storageGetAllKeys.mockReturnValue([])
        resetKeystoreStateForTest()
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
        // WithMigrations throws MissingLedgerError without one; a fresh
        // in-memory ledger is enough since this test never awaits a run.
        const dummy = new PeraProvider(
            { id: 'x', name: 'X' },
            { migrations: { ledger: memoryLedger() } },
        )
        initializeProvider(dummy)

        expect(getProvider()).toBe(dummy)
        expect(() => initializeProvider(dummy)).toThrow(
            /Provider already initialized/,
        )
    })

    test('clearKeystore delegates to the keystore instance', async () => {
        keystoreMocks.clear.mockResolvedValue(undefined)

        await clearKeystore()

        expect(keystoreMocks.clear).toHaveBeenCalled()
    })

    // Bootstrap awaits this rather than a hand-rolled hydrate: the engine loads
    // persisted metadata into the reactive store before `ready` resolves.
    test('getKeystore exposes the engine ready promise', async () => {
        await expect(getKeystore().ready).resolves.toBeUndefined()
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

    describe('reconcileKeystore', () => {
        const seedReactiveStore = (keys: { id: string }[]): void => {
            const store = getKeystoreStore() as unknown as {
                state: { keys: unknown[] }
            }
            store.state.keys = keys
        }

        test('leaves the store untouched when the metadata bucket is empty', async () => {
            seedReactiveStore([{ id: 'a' }])
            keystoreMocks.storageGetAllKeys.mockReturnValue([])

            const result = await reconcileKeystore()

            expect(getKeystoreStore().state.keys).toEqual([{ id: 'a' }])
            expect(result).toEqual({ failedIds: [] })
        })

        // Material lives under `m/` and only metadata under `k/`; reading the
        // material bucket would hand `decode` a sealed payload.
        test('reads only the k/ bucket, stripped of its prefix', async () => {
            keystoreMocks.storageGetAllKeys.mockReturnValue(['m/a', 'k/a'])
            keystoreMocks.storageGetString.mockImplementation((key: string) =>
                key === 'k/a' ? '{"meta":"a"}' : 'sealed-a',
            )
            keystoreMocks.decode.mockReturnValue({
                id: 'a',
                type: 'hd-derived-p256',
                algorithm: 'P256',
            })

            await reconcileKeystore()

            expect(keystoreMocks.decode).toHaveBeenCalledExactlyOnceWith(
                '{"meta":"a"}',
            )
            expect(getKeystoreStore().state.keys).toEqual([
                { id: 'a', type: 'hd-derived-p256', algorithm: 'P256' },
            ])
        })

        test('re-seeds the store, adding new keys and refreshing metadata on existing ones', async () => {
            // 'a' is already in the reactive store but stale (no lastUsedAt);
            // 'b' is new. The credential provider (separate process) just bumped
            // 'a'.lastUsedAt in MMKV on use, so reconcile must surface both the
            // new key and the refreshed metadata on the existing one.
            seedReactiveStore([
                {
                    id: 'a',
                    metadata: { origin: 'webauthn.io', userHandle: 'alice' },
                },
            ])
            keystoreMocks.storageGetAllKeys.mockReturnValue(['k/a', 'k/b'])
            keystoreMocks.storageGetString.mockImplementation(
                (key: string) => `{"record":"${key}"}`,
            )
            keystoreMocks.decode.mockImplementation((raw: string) =>
                raw === '{"record":"k/a"}'
                    ? {
                          id: 'a',
                          type: 'hd-derived-p256',
                          algorithm: 'P256',
                          metadata: {
                              origin: 'webauthn.io',
                              userHandle: 'alice',
                              lastUsedAt: 1234,
                          },
                      }
                    : {
                          id: 'b',
                          type: 'hd-derived-p256',
                          algorithm: 'P256',
                          metadata: {
                              origin: 'example.com',
                              userHandle: 'bob',
                          },
                      },
            )

            await reconcileKeystore()

            const keys = getKeystoreStore().state.keys as Array<{
                id: string
                metadata?: { lastUsedAt?: number }
            }>
            expect(keys.find(k => k.id === 'a')?.metadata?.lastUsedAt).toBe(
                1234,
            )
            expect(keys.some(k => k.id === 'b')).toBe(true)
        })

        test('skips entries that fail to decode, keeps the rest, and reports the failures', async () => {
            keystoreMocks.storageGetAllKeys.mockReturnValue(['k/good', 'k/bad'])
            keystoreMocks.storageGetString.mockReturnValue('{"meta":true}')
            keystoreMocks.decode.mockImplementationOnce(() => ({
                id: 'good',
                type: 'algo25',
                algorithm: 'EdDSA',
            }))
            keystoreMocks.decode.mockImplementationOnce(() => {
                throw new Error('decode failed')
            })

            const result = await reconcileKeystore()

            const keys = getKeystoreStore().state.keys as Array<{ id: string }>
            expect(keys).toHaveLength(1)
            expect(keys[0].id).toBe('good')
            expect(result.failedIds).toEqual(['k/bad'])
        })
    })
})
