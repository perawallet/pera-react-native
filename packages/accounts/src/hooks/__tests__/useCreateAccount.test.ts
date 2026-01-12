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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCreateAccount } from '../useCreateAccount'
import { useAccountsStore } from '../../store'
import {
    registerTestPlatform,
    MemoryKeyValueStorage,
} from '@perawallet/wallet-core-platform-integration'
import { KeyPair, KeyType } from '@perawallet/wallet-core-kms'

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const hdWalletSpies = vi.hoisted(() => ({
    generateMasterKey: vi.fn(),
    deriveAccountAddress: vi.fn(),
}))
vi.mock('../useHDWallet', () => ({
    useHDWallet: () => hdWalletSpies,
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
    KeyContext: { Address: 0 },
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        encodeAlgorandAddress: vi.fn((address: Uint8Array) =>
            Buffer.from(address).toString('base64'),
        ),
    }
})

const kmdSpies = vi.hoisted(() => ({
    useKMD: vi.fn().mockReturnValue({
        saveKey: vi.fn(),
        getKey: vi.fn(),
        removeKey: vi.fn(),
        executeWithKey: vi.fn(),
    }),
    useWithKey: vi.fn().mockReturnValue({
        executeWithKey: vi.fn(),
    }),
    getKey: vi.fn(),
    saveKey: vi.fn(),
    removeKey: vi.fn(),
    executeWithKey: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<typeof import('kms/src')>(
        '@perawallet/wallet-core-kms',
    )
    return {
        ...actual,
        ...kmdSpies,
    }
})

vi.mock('@perawallet/wallet-core-platform-integration', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-platform-integration')
    >('@perawallet/wallet-core-platform-integration')
    return {
        ...actual,
        useKeyValueStorageService: vi.fn().mockReturnValue({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
        useUpdateDeviceMutation: vi.fn(() => ({
            mutateAsync: vi.fn(async () => ({})),
        })),
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
        useDeviceID: vi.fn(() => 'device-id'),
    }
})

vi.mock('../../store', async () => {
    const actual =
        await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAccountsStore: actual.createAccountsStore(mockStorage as any),
    }
})

describe('useCreateAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        hdWalletSpies.generateMasterKey.mockResolvedValue({
            seed: Buffer.from('seed'),
            entropy: Buffer.from('entropy'),
        })
        hdWalletSpies.deriveAccountAddress.mockResolvedValue({
            address: new Uint8Array(32).fill(2),
        })
        // Reset KMD mocks to default behavior
        kmdSpies.useKMD.mockReturnValue({
            saveKey: vi.fn(k => k), // Default to return input
            getKey: vi.fn(() => null),
            removeKey: vi.fn(),
        })
        kmdSpies.useWithKey.mockReturnValue({
            executeWithKey: vi.fn(async (_, __, handler) =>
                handler(new Uint8Array()),
            ),
        })
    })

    test('creates account and persists keys', async () => {
        const storage = new Map<string, any>()
        const dummySecure = {
            setItem: vi.fn(async (key, value) => {
                storage.set(key, value)
            }),
            getItem: vi.fn(async key => storage.get(key) ?? null),
            removeItem: vi.fn(async key => {
                storage.delete(key)
            }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const addr = new Uint8Array(32).fill(2)
        hdWalletSpies.deriveAccountAddress.mockResolvedValueOnce({
            address: addr,
        })

        // Configure KMD mocks
        const mockSaveKey = vi.fn(async keyPair => {
            // Simulate actual saveKey behavior by storing in secure storage
            if (keyPair.id) {
                const data =
                    keyPair.type === KeyType.HDWalletRootKey
                        ? new TextEncoder().encode(
                              JSON.stringify({ seed: 'test', entropy: 'test' }),
                          )
                        : new Uint8Array(32).fill(1)
                storage.set(keyPair.id, data)
            }
            return keyPair
        })
        const mockGetKey = vi.fn(() => null) // No existing root key
        const mockExecuteWithKey = vi.fn(async (id, _, handler) => {
            // Simulate reading the stored master key
            const data = storage.get(id)
            if (!data) return null
            return handler(data)
        })

        kmdSpies.useKMD.mockReturnValue({
            saveKey: mockSaveKey,
            getKey: mockGetKey,
            removeKey: vi.fn(),
        })
        kmdSpies.useWithKey.mockReturnValue({
            executeWithKey: mockExecuteWithKey,
        })

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current({ account: 0, keyIndex: 0 })
        })

        // Verify saveKey was called only for root key
        expect(mockSaveKey).toHaveBeenCalledTimes(1)
        expect(mockSaveKey).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                id: 'WALLET1',
                type: KeyType.HDWalletRootKey,
            }),
            expect.anything(),
        )

        expect(created).toMatchObject({
            id: 'KEY1',
        })
        expect(created.address).toBeTruthy()
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws error when deriveKey fails', async () => {
        const storage = new Map<string, any>()
        // Pre-populate with valid master key data
        storage.set(
            'WALLET1',
            new TextEncoder().encode(
                JSON.stringify({ seed: 'testseed', entropy: 'test' }),
            ),
        )

        const dummySecure = {
            setItem: vi.fn(async (key, value) => {
                storage.set(key, value)
            }),
            getItem: vi.fn(async key => {
                return storage.get(key) ?? null
            }),
            removeItem: vi.fn(async key => {
                storage.delete(key)
            }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Configure KMD mocks
        const mockGetKey = vi.fn(() => ({ id: 'WALLET1' })) // Key exists
        const mockExecuteWithKey = vi.fn(async (id, _, handler) => {
            const data = storage.get(id)
            return handler(data)
        })

        kmdSpies.useKMD.mockReturnValue({
            saveKey: vi.fn(),
            getKey: mockGetKey,
            removeKey: vi.fn(),
        })
        kmdSpies.useWithKey.mockReturnValue({
            executeWithKey: mockExecuteWithKey,
        })

        // Make deriveAccountAddress throw an error
        hdWalletSpies.deriveAccountAddress.mockRejectedValueOnce(
            new Error('Derivation failed'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({
                    walletId: 'WALLET1',
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('Derivation failed')
        })
    })

    test('throws error when master key has no seed', async () => {
        const storage = new Map<string, any>()
        // Pre-populate with key that has no seed
        storage.set(
            'WALLET1',
            new TextEncoder().encode(JSON.stringify({ entropy: 'test' })),
        )

        const dummySecure = {
            setItem: vi.fn(async (key, value) => {
                storage.set(key, value)
            }),
            getItem: vi.fn(async (key: string) => {
                return storage.get(key) ?? null
            }),
            removeItem: vi.fn(async key => {
                storage.delete(key)
            }),
            authenticate: vi.fn(async () => true),
        }

        const kvStorage = new MemoryKeyValueStorage()
        kvStorage.setJSON('WALLET1', {
            id: 'WALLET1',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        } as KeyPair)

        registerTestPlatform({
            keyValueStorage: kvStorage as any,
            secureStorage: dummySecure as any,
        })

        // Configure KMD mocks
        const mockGetKey = vi.fn(() => ({ id: 'WALLET1' })) // Key exists
        const mockExecuteWithKey = vi.fn(async (id, _, handler) => {
            const data = storage.get(id)
            return handler(data)
        })

        kmdSpies.useKMD.mockReturnValue({
            saveKey: vi.fn(),
            getKey: mockGetKey,
            removeKey: vi.fn(),
        })
        kmdSpies.useWithKey.mockReturnValue({
            executeWithKey: mockExecuteWithKey,
        })

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({
                    walletId: 'WALLET1',
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('errors.account.no_hd_wallet')
        })
    })

    test('throws error when generateMasterKey fails', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Make generateMasterKey throw
        hdWalletSpies.generateMasterKey.mockRejectedValueOnce(
            new Error('Failed to generate master key'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({ account: 0, keyIndex: 0 }),
            ).rejects.toThrow('Failed to generate master key')
        })
    })

    test('creates account with existing master key', async () => {
        // Clear all previous mocks to prevent bleed
        vi.clearAllMocks()

        const existingSeed = Buffer.from('existing_seed').toString('base64')
        const storage = new Map<string, any>()
        // Pre-populate storage with existing master key
        storage.set(
            'EXISTING_WALLET',
            new TextEncoder().encode(
                JSON.stringify({
                    seed: existingSeed,
                    entropy: 'existing_entropy',
                }),
            ),
        )

        const dummySecure = {
            setItem: vi.fn(async (key, value) => {
                storage.set(key, value)
            }),
            getItem: vi.fn(async (key: string) => {
                return storage.get(key) ?? null
            }),
            removeItem: vi.fn(async key => {
                storage.delete(key)
            }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const addr = new Uint8Array(32).fill(2)
        hdWalletSpies.deriveAccountAddress.mockResolvedValueOnce({
            address: addr,
        })

        // Configure KMD mocks
        const mockSaveKey = vi.fn()
        const mockGetKey = vi.fn(() => ({ id: 'EXISTING_WALLET' })) // Existing root key
        const mockExecuteWithKey = vi.fn(async (id, _, handler) => {
            const data = storage.get(id)
            return handler(data)
        })

        kmdSpies.useKMD.mockReturnValue({
            saveKey: mockSaveKey,
            getKey: mockGetKey,
            removeKey: vi.fn(),
        })
        kmdSpies.useWithKey.mockReturnValue({
            executeWithKey: mockExecuteWithKey,
        })

        uuidSpies.v7
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')
            .mockImplementationOnce(() => 'ACC_UUID')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current({
                walletId: 'EXISTING_WALLET',
                account: 0,
                keyIndex: 0,
            })
        })

        expect(created).toBeTruthy()
        expect(created.hdWalletDetails?.walletId).toBe('EXISTING_WALLET')
        // Should NOT call saveKey since root key exists and we don't save derived keys
        expect(mockSaveKey).toHaveBeenCalledTimes(0)
    })
})
