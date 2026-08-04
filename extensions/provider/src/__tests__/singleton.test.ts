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
    decryptData: vi.fn(),
    readMasterKey: vi.fn(),
    storageGetAllKeys: vi.fn(() => [] as string[]),
    storageGetString: vi.fn(),
    initializeKeyStore: vi.fn(),
    addKey: vi.fn(),
}))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    clear: keystoreMocks.clear,
    decode: keystoreMocks.decode,
    decryptData: keystoreMocks.decryptData,
    readMasterKey: keystoreMocks.readMasterKey,
    storage: {
        getAllKeys: keystoreMocks.storageGetAllKeys,
        getString: keystoreMocks.storageGetString,
    },
}))

vi.mock('@algorandfoundation/keystore', () => ({
    initializeKeyStore: keystoreMocks.initializeKeyStore,
    addKey: keystoreMocks.addKey,
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

// Minimal fake of @tanstack/store's Store for the singleton's keystoreStore
// instance. The singleton uses `state.keys` (read) and is mutated via
// `initializeKeyStore` (which we mock) — neither path needs real subscriptions.
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

import {
    getProvider,
    getKeystoreStore,
    getKeystoreHooks,
    initializeProvider,
    resetProvider,
    clearKeystore,
    hydrateKeystore,
    reconcileKeystore,
} from '../singleton'
import { PeraProvider } from '../pera-provider'

const resetKeystoreStateForTest = (): void => {
    // The keystoreStore singleton is constructed once at module load. Reset
    // its `state.keys` between tests so hydrateKeystore's "skip if already
    // populated" guard doesn't leak across cases.
    const store = getKeystoreStore() as unknown as {
        state: { keys: unknown[]; status: string }
    }
    store.state = { keys: [], status: 'idle' }
}

describe('provider singleton', () => {
    beforeEach(() => {
        keystoreMocks.clear.mockReset()
        keystoreMocks.decode.mockReset()
        keystoreMocks.decryptData.mockReset()
        keystoreMocks.readMasterKey.mockReset()
        keystoreMocks.storageGetAllKeys.mockReset()
        keystoreMocks.storageGetString.mockReset()
        keystoreMocks.initializeKeyStore.mockReset()
        keystoreMocks.addKey.mockReset()
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
        const dummy = new PeraProvider({ id: 'x', name: 'X' })
        initializeProvider(dummy)

        expect(getProvider()).toBe(dummy)
        expect(() => initializeProvider(dummy)).toThrow(
            /Provider already initialized/,
        )
    })

    test('clearKeystore delegates to the native keystore clear', async () => {
        keystoreMocks.clear.mockResolvedValue(undefined)

        await clearKeystore()

        expect(keystoreMocks.clear).toHaveBeenCalledWith(
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

    describe('hydrateKeystore', () => {
        test('no-ops when MMKV has no entries', async () => {
            keystoreMocks.storageGetAllKeys.mockReturnValue([])

            await hydrateKeystore()

            expect(keystoreMocks.readMasterKey).not.toHaveBeenCalled()
            expect(keystoreMocks.initializeKeyStore).not.toHaveBeenCalled()
        })

        test('skips when reactive store already has entries', async () => {
            const store = getKeystoreStore() as unknown as {
                state: { keys: unknown[] }
            }
            store.state.keys = [{ id: 'already-here' }]

            await hydrateKeystore()

            expect(keystoreMocks.storageGetAllKeys).not.toHaveBeenCalled()
            expect(keystoreMocks.readMasterKey).not.toHaveBeenCalled()
        })

        test('decrypts each MMKV entry, strips private material, and initializes the store', async () => {
            keystoreMocks.storageGetAllKeys.mockReturnValue([
                'wallet-1',
                'wallet-2',
            ])
            keystoreMocks.storageGetString.mockImplementation((id: string) =>
                id === 'wallet-1' ? 'cipher-1' : 'cipher-2',
            )
            const masterKey = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
            keystoreMocks.readMasterKey.mockResolvedValue(masterKey)
            keystoreMocks.decryptData.mockImplementation(
                (_key: Buffer, payload: string) => `decrypted:${payload}`,
            )
            const sensitive1 = new Uint8Array([9, 9, 9])
            const sensitive2 = new Uint8Array([8, 8])
            keystoreMocks.decode.mockImplementationOnce(() => ({
                id: 'wallet-1',
                type: 'hd-root-key',
                algorithm: 'raw',
                privateKey: sensitive1,
            }))
            keystoreMocks.decode.mockImplementationOnce(() => ({
                id: 'wallet-2',
                type: 'algo25',
                algorithm: 'EdDSA',
                seed: sensitive2,
            }))

            await hydrateKeystore()

            expect(keystoreMocks.initializeKeyStore).toHaveBeenCalledTimes(1)
            const arg = keystoreMocks.initializeKeyStore.mock.calls[0][0]
            // The reactive store gets metadata only — never private material.
            expect(arg.keys).toHaveLength(2)
            expect(arg.keys[0]).toMatchObject({
                id: 'wallet-1',
                type: 'hd-root-key',
            })
            expect(arg.keys[0]).not.toHaveProperty('privateKey')
            expect(arg.keys[1]).toMatchObject({
                id: 'wallet-2',
                type: 'algo25',
            })
            expect(arg.keys[1]).not.toHaveProperty('seed')
            // Private material was zeroed before being added to the reactive
            // store. Master key copy was also zeroed.
            expect(Array.from(sensitive1)).toEqual([0, 0, 0])
            expect(Array.from(sensitive2)).toEqual([0, 0])
            expect(Array.from(masterKey)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
        })

        // The web keystore binds each ciphertext to its storage key as GCM AAD,
        // so hydration must pass that key through. When it didn't, every bound
        // entry failed its ghash tag, got skipped, and the wallet reported its
        // own seed as "The specified key was not found."
        test('passes each entry storage key through as the AAD argument', async () => {
            keystoreMocks.storageGetAllKeys.mockReturnValue([
                'seed-1',
                'seed-2',
            ])
            keystoreMocks.storageGetString.mockImplementation(
                (id: string) => `cipher-for-${id}`,
            )
            keystoreMocks.readMasterKey.mockResolvedValue(Buffer.from([1]))
            // Stands in for AES-GCM with AAD: the wrong key id fails the tag.
            keystoreMocks.decryptData.mockImplementation(
                (_key: Buffer, payload: string, keyId?: string) => {
                    if (payload !== `cipher-for-${keyId}`) {
                        throw new Error('aes/gcm: invalid ghash tag')
                    }
                    return `decrypted:${keyId}`
                },
            )
            keystoreMocks.decode.mockImplementation((plaintext: string) => ({
                id: plaintext.replace('decrypted:', ''),
                type: 'algo25',
                algorithm: 'EdDSA',
            }))

            await hydrateKeystore()

            expect(keystoreMocks.decryptData).toHaveBeenCalledWith(
                expect.anything(),
                'cipher-for-seed-1',
                'seed-1',
            )
            // Both entries survive hydration rather than being skipped.
            const arg = keystoreMocks.initializeKeyStore.mock.calls[0][0]
            expect(arg.keys.map((k: { id: string }) => k.id)).toEqual([
                'seed-1',
                'seed-2',
            ])
        })

        test('skips entries that fail to decode and continues with the rest', async () => {
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            keystoreMocks.storageGetAllKeys.mockReturnValue(['good', 'bad'])
            keystoreMocks.storageGetString.mockReturnValue('cipher')
            keystoreMocks.readMasterKey.mockResolvedValue(Buffer.from([0]))
            keystoreMocks.decryptData.mockReturnValue('decrypted')
            keystoreMocks.decode.mockImplementationOnce(() => ({
                id: 'good',
                type: 'algo25',
                algorithm: 'EdDSA',
            }))
            keystoreMocks.decode.mockImplementationOnce(() => {
                throw new Error('decode failed')
            })

            await hydrateKeystore()

            const arg = keystoreMocks.initializeKeyStore.mock.calls[0][0]
            expect(arg.keys).toHaveLength(1)
            expect(arg.keys[0].id).toBe('good')
            expect(consoleError).toHaveBeenCalled()
            consoleError.mockRestore()
        })

        test('zeros the master key even when an entry throws', async () => {
            keystoreMocks.storageGetAllKeys.mockReturnValue(['k'])
            keystoreMocks.storageGetString.mockReturnValue('cipher')
            const masterKey = Buffer.from([42, 42, 42])
            keystoreMocks.readMasterKey.mockResolvedValue(masterKey)
            keystoreMocks.decryptData.mockImplementation(() => {
                throw new Error('decrypt failed')
            })
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})

            await hydrateKeystore()

            expect(Array.from(masterKey)).toEqual([0, 0, 0])
            consoleError.mockRestore()
        })
    })

    describe('reconcileKeystore', () => {
        const seedReactiveStore = (keys: { id: string }[]): void => {
            const store = getKeystoreStore() as unknown as {
                state: { keys: unknown[] }
            }
            store.state.keys = keys
        }

        test('no-ops (without fetching the master key) when MMKV has no entries', async () => {
            seedReactiveStore([{ id: 'a' }])
            keystoreMocks.storageGetAllKeys.mockReturnValue([])

            await reconcileKeystore()

            expect(keystoreMocks.readMasterKey).not.toHaveBeenCalled()
            expect(keystoreMocks.initializeKeyStore).not.toHaveBeenCalled()
        })

        test('re-seeds the store from MMKV, adding new keys and refreshing metadata on existing ones', async () => {
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
            keystoreMocks.storageGetAllKeys.mockReturnValue(['a', 'b'])
            keystoreMocks.storageGetString.mockImplementation(
                (id: string) => `cipher-${id}`,
            )
            const masterKey = Buffer.from([1, 2, 3])
            keystoreMocks.readMasterKey.mockResolvedValue(masterKey)
            keystoreMocks.decryptData.mockImplementation(
                (_mk: unknown, cipher: string) => `decrypted-${cipher}`,
            )
            keystoreMocks.decode.mockImplementation((decrypted: string) =>
                decrypted === 'decrypted-cipher-a'
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

            expect(keystoreMocks.initializeKeyStore).toHaveBeenCalledTimes(1)
            const seededKeys = keystoreMocks.initializeKeyStore.mock.calls[0][0]
                .keys as Array<{
                id: string
                metadata?: { lastUsedAt?: number }
            }>
            const refreshedA = seededKeys.find(k => k.id === 'a')
            expect(refreshedA?.metadata?.lastUsedAt).toBe(1234)
            expect(seededKeys.some(k => k.id === 'b')).toBe(true)
            // Master key copy was zeroed after use.
            expect(Array.from(masterKey)).toEqual([0, 0, 0])
        })
    })
})
