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
import { KeyType } from '@perawallet/wallet-core-kms'

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
    KeyContext: { Address: 0 },
    XHDWalletAPI: class {},
    fromSeed: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn((address: Uint8Array) =>
        Buffer.from(address).toString('base64'),
    ),
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...actual,
        generateOrderedUniqueId: uuidSpies.v7,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const mockSession = vi.hoisted(() => ({
    getPublicKey: vi.fn(),
}))

const kmsMock = vi.hoisted(() => ({
    getKey: vi.fn(),
    getKeyOrThrow: vi.fn(),
    createHDWalletKey: vi.fn(),
    createAlgo25Key: vi.fn(),
    withHDSession: vi.fn(async (_key: any, _domain: any, handler: any) =>
        handler(mockSession),
    ),
}))

vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-kms')
    >('@perawallet/wallet-core-kms')
    return {
        ...actual,
        useKMS: vi.fn(() => kmsMock),
    }
})

vi.mock('@perawallet/wallet-extension-platform', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-extension-platform')
    >('@perawallet/wallet-extension-platform')
    return {
        ...actual,
        useKeyValueStorageService: vi.fn().mockReturnValue({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
        useSecureStorageService: vi.fn().mockReturnValue({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
        useUpdateDeviceMutation: vi.fn(() => ({
            mutateAsync: vi.fn(async () => ({})),
        })),
        useDeviceID: vi.fn(() => 'device-id'),
        useDeviceInfoService: vi.fn(() => ({
            getDevicePlatform: vi.fn(() => 'ios'),
        })),
    }
})

describe('useImportAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        kmsMock.getKey.mockReset()
        kmsMock.getKeyOrThrow.mockReset()
        kmsMock.createHDWalletKey.mockReset()
        kmsMock.createAlgo25Key.mockReset()
        kmsMock.withHDSession.mockReset()

        kmsMock.getKey.mockReturnValue(null)
        kmsMock.getKeyOrThrow.mockReturnValue(null)
        kmsMock.createHDWalletKey.mockResolvedValue({
            id: 'WALLET1',
            type: KeyType.HDWalletRootKey,
            publicKey: '',
        })
        kmsMock.createAlgo25Key.mockResolvedValue({
            id: 'WALLET1',
            type: KeyType.Algo25Key,
            publicKey: 'ALGO25_PUBLIC_KEY',
        })
        kmsMock.withHDSession.mockImplementation(
            async (_key: any, _domain: any, handler: any) =>
                handler(mockSession),
        )
        mockSession.getPublicKey.mockReset()
        mockSession.getPublicKey.mockResolvedValue(new Uint8Array(32).fill(2))
    })

    test('imports HD wallet account with mnemonic', async () => {
        // After createHDWalletKey, getKey should return the created key
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: KeyType.HDWalletRootKey,
            publicKey: '',
        })

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'hdWallet',
            })
        })

        expect(kmsMock.createHDWalletKey).toHaveBeenCalledWith({
            mnemonic: 'test mnemonic',
        })
        expect(imported.address).toBeTruthy()
        expect(imported.type).toBe('hdWallet')
        expect(imported.keyPairId).toBe('WALLET1')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws when createHDWalletKey fails with invalid mnemonic', async () => {
        kmsMock.createHDWalletKey.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

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

    test('throws when address derivation fails', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: KeyType.HDWalletRootKey,
            publicKey: '',
        })
        mockSession.getPublicKey.mockRejectedValueOnce(
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

    test('imports algo25 account with mnemonic', async () => {
        // createAlgo25Key called twice:
        // 1st: in useImportAccount with mnemonic
        // 2nd: in createAlgo25WalletAccount without mnemonic
        kmsMock.createAlgo25Key
            .mockResolvedValueOnce({
                id: 'WALLET1',
                type: KeyType.Algo25Key,
                publicKey: '',
            })
            .mockResolvedValueOnce({
                id: 'KEY2',
                type: KeyType.Algo25Key,
                publicKey: 'ALGO25_PUBLIC_KEY',
            })

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY2')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenNthCalledWith(1, {
            mnemonic: 'test mnemonic',
        })
        expect(imported.address).toBe('ALGO25_PUBLIC_KEY')
        expect(imported.type).toBe('algo25')
        expect(imported.keyPairId).toBe('KEY2')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws when createAlgo25Key fails', async () => {
        kmsMock.createAlgo25Key.mockRejectedValueOnce(
            new Error('Import failed'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'test mnemonic',
                    type: 'algo25',
                }),
            ).rejects.toThrow('Import failed')
        })
    })
})
