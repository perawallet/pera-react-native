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
import { useImportAccount } from '../useImportAccount'
import { useAccountsStore } from '../../store'
import {
    registerTestPlatform,
    MemoryKeyValueStorage,
} from '@perawallet/wallet-core-platform-integration'

// Mocks (similar to useCreateAccount)
const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const apiSpies = vi.hoisted(() => ({
    deriveSpy: vi.fn(),
    keyGenSpy: vi.fn(),
    signTransactionSpy: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
}))

const xhdSpies = vi.hoisted(() => ({ fromSeed: vi.fn(() => 'ROOT_KEY') }))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
    fromSeed: xhdSpies.fromSeed,
    KeyContext: { Address: 0 },
    XHDWalletAPI: class {
        deriveKey = apiSpies.deriveSpy
        keyGen = apiSpies.keyGenSpy
        signAlgoTransaction = apiSpies.signTransactionSpy
    },
}))

const bip39Spies = vi.hoisted(() => ({
    generateMnemonic: vi.fn(() => 'test mnemonic'),
    mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
    mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
    mnemonicToEntropy: vi.fn(async () => Buffer.from('entropy')),
}))
vi.mock('bip39', () => bip39Spies)

const algo25Spies = vi.hoisted(() => ({
    seedFromMnemonic: vi.fn(() => new Uint8Array(32).fill(3)),
}))
vi.mock('@algorandfoundation/algokit-utils/algo25', () => ({
    seedFromMnemonic: algo25Spies.seedFromMnemonic,
}))

const naclSpies = vi.hoisted(() => ({
    sign: {
        keyPair: {
            fromSeed: vi.fn(() => ({
                publicKey: new Uint8Array(32).fill(4),
                secretKey: new Uint8Array(64).fill(5),
            })),
        },
    },
}))
vi.mock('tweetnacl', () => ({
    default: naclSpies,
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    return {
        encodeAlgorandAddress: vi.fn((address: Uint8Array) =>
            Buffer.from(address).toString('base64'),
        ),
        useTransactionEncoder: vi.fn(() => ({
            encodeTransaction: vi.fn(),
        })),
    }
})

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

const kmsSpies = vi.hoisted(() => {
    const keys = new Map<string, any>()
    return {
        saveKey: vi.fn(async (key: any) => {
            keys.set(key.id, key)
            return key
        }),
        getKey: vi.fn((id: string) => keys.get(id) || null),
        executeWithKey: vi.fn(
            async (_id: string, _domain: string, handler: any) => {
                const dummyData = JSON.stringify({
                    seed: Buffer.from('seed').toString('base64'),
                    entropy: 'entropy',
                })
                return handler(new TextEncoder().encode(dummyData))
            },
        ),
    }
})

vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-kms')
    >('@perawallet/wallet-core-kms')
    return {
        ...actual,
        useKMS: vi.fn(() => ({
            saveKey: kmsSpies.saveKey,
            getKey: kmsSpies.getKey,
            deleteKey: vi.fn(),
            getPrivateData: vi.fn(),
            keys: new Map(),
        })),
        useWithKey: vi.fn(() => ({
            executeWithKey: kmsSpies.executeWithKey,
        })),
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

describe('useImportAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
    })

    test('imports account and persists keys', async () => {
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

        const priv = new Uint8Array(32).fill(1)
        const addr = new Uint8Array(32).fill(2)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'hdWallet',
            })
        })

        expect(imported.address).toBeTruthy()
        expect(imported.id).toBeTruthy()

        // Verify kms calls
        expect(kmsSpies.saveKey).toHaveBeenCalledTimes(1)
        expect(kmsSpies.saveKey).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                id: 'WALLET1',
                type: 'hdwallet-root-key',
            }),
            expect.anything(),
        )
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws error when generateMasterKey fails with invalid mnemonic', async () => {
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

        // Make bip39 throw on invalid mnemonic
        bip39Spies.mnemonicToSeed.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'invalid mnemonic',
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Invalid mnemonic')
        })
    })

    test('throws error when secure storage setItem fails for root key', async () => {
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

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')
        kmsSpies.saveKey.mockRejectedValueOnce(new Error('Storage full'))

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'test mnemonic',
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Storage full')
        })
    })

    test('throws error when mnemonicToEntropy fails', async () => {
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

        bip39Spies.mnemonicToSeed.mockResolvedValueOnce(Buffer.from('seed'))
        bip39Spies.mnemonicToEntropy.mockRejectedValueOnce(
            new Error('Invalid entropy'),
        )

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'test mnemonic',
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Invalid entropy')
        })
    })

    test('imports account with custom walletId', async () => {
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

        const priv = new Uint8Array(32).fill(1)
        const addr = new Uint8Array(32).fill(2)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                walletId: 'CUSTOM_WALLET',
                mnemonic: 'test mnemonic',
                type: 'hdWallet',
            })
        })

        expect(imported).toBeTruthy()
        expect(imported.hdWalletDetails?.walletId).toBe('CUSTOM_WALLET')
        // Verify kms calls
        expect(kmsSpies.saveKey).toHaveBeenCalledTimes(1)
        expect(kmsSpies.saveKey).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                id: 'CUSTOM_WALLET',
            }),
            expect.anything(),
        )
    })

    test('throws error when address generation fails', async () => {
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

        const priv = new Uint8Array(32).fill(1)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockRejectedValueOnce(
            new Error('Address generation failed'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'test mnemonic',
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Address generation failed')
        })
    })

    test('imports algo25 account and persists keys', async () => {
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

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'algo25',
            })
        })

        expect(imported.address).toBe(
            'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=',
        )
        expect(imported.id).toBeTruthy()
        expect(imported.type).toBe('algo25')

        // Verify kms calls
        expect(kmsSpies.saveKey).toHaveBeenCalledTimes(1)
        expect(kmsSpies.saveKey).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                id: 'WALLET1',
                type: 'algo25-key',
                publicKey: 'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=', // base64(fill(4))
            }),
            expect.anything(),
        )
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })
})
