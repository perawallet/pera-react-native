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
import { AccountKeyNotFoundError } from '../../errors'

// Mocks
const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const apiSpies = vi.hoisted(() => ({
    deriveSpy: vi.fn(),
    keyGenSpy: vi.fn(),
    signTransactionSpy: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
}))

const xhdSpies = vi.hoisted(() => ({ fromSeed: vi.fn(() => 'ROOT_KEY') }))

vi.mock('@perawallet/wallet-core-xhdwallet', () => ({
    BIP32DerivationType: { Peikert: 'PEIKERT' },
    BIP32DerivationTypes: { Peikert: 9 },
    fromSeed: xhdSpies.fromSeed,
    KeyContext: { Address: 'Address' },
    KeyContexts: { Address: 0 },
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

// Mock API hooks used by useCreateAccount
vi.mock('../../../api/generated/backend', () => ({
    useV1DevicesPartialUpdate: vi.fn(() => ({ mutateAsync: vi.fn() })),
    // Add others if needed
}))

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
    })

    test('creates account and persists keys', async () => {
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

        const priv = new Uint8Array(32).fill(1)
        const addr = new Uint8Array(32).fill(2)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current({ account: 0, keyIndex: 0 })
        })

        expect(created).toMatchObject({
            id: 'ACC1',
            privateKeyLocation: 'pk-KEY1',
        })
        expect(created.address).toBeTruthy()

        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'rootkey-WALLET1',
            expect.any(Buffer),
        )
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-KEY1',
            expect.any(Buffer),
        )
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws error when deriveKey fails', async () => {
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

        // Make deriveKey throw an error
        apiSpies.deriveSpy.mockRejectedValueOnce(new Error('Derivation failed'))

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({ account: 0, keyIndex: 0 }),
            ).rejects.toThrow('Derivation failed')
        })
    })

    test('throws error when master key has no seed', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () =>
                Buffer.from(JSON.stringify({ entropy: 'test' })),
            ), // No seed property
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({ account: 0, keyIndex: 0 }),
            ).rejects.toThrow(new AccountKeyNotFoundError('WALLET1'))
        })
    })

    test('throws error when secure storage setItem fails for private key', async () => {
        const dummySecure = {
            setItem: vi
                .fn()
                .mockResolvedValueOnce(undefined) // First call for root key succeeds
                .mockRejectedValueOnce(new Error('Storage full')), // Second call for private key fails
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => {}),
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

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({ account: 0, keyIndex: 0 }),
            ).rejects.toThrow('Storage full')
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
        bip39Spies.mnemonicToSeed.mockRejectedValueOnce(
            new Error('Failed to generate master key'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current({ account: 0, keyIndex: 0 }),
            ).rejects.toThrow('errors.account.key_access_error')
        })
    })

    test('creates account with existing master key', async () => {
        const existingSeed = Buffer.from('existing_seed').toString('base64')
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () =>
                Buffer.from(
                    JSON.stringify({
                        seed: existingSeed,
                        entropy: 'existing_entropy',
                    }),
                ),
            ),
            removeItem: vi.fn(async () => {}),
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
        // Should not call setItem for root key since it already exists
        expect(dummySecure.setItem).toHaveBeenCalledTimes(1) // Only for private key
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-KEY1',
            expect.any(Buffer),
        )
    })
})
