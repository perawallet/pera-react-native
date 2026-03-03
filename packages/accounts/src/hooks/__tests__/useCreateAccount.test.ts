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
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: uuidSpies.v7,
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

vi.mock('@perawallet/wallet-extension-network', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
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

    test('creates new HD wallet account when no existing key', async () => {
        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createHdWalletAccount({
                account: 0,
                keyIndex: 0,
            })
        })

        expect(kmsMock.createHDWalletKey).toHaveBeenCalledWith({
            id: 'WALLET1',
        })
        expect(mockSession.getPublicKey).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
            derivationType: 9,
        })
        expect(created.id).toBe('ACC1')
        expect(created.address).toBeTruthy()
        expect(created.type).toBe('hdWallet')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('creates account with existing key', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'EXISTING_WALLET',
            type: KeyType.HDWalletRootKey,
            publicKey: '',
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createHdWalletAccount({
                walletId: 'EXISTING_WALLET',
                account: 0,
                keyIndex: 0,
            })
        })

        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
        expect(created.keyPairId).toBe('EXISTING_WALLET')
    })

    test('throws error when session getPublicKey fails', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: KeyType.HDWalletRootKey,
            publicKey: '',
        })
        mockSession.getPublicKey.mockRejectedValueOnce(
            new Error('Derivation failed'),
        )

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createHdWalletAccount({
                    walletId: 'WALLET1',
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('Derivation failed')
        })
    })

    test('throws error when createHDWalletKey fails', async () => {
        kmsMock.createHDWalletKey.mockRejectedValueOnce(
            new Error('Failed to generate master key'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createHdWalletAccount({
                    account: 0,
                    keyIndex: 0,
                }),
            ).rejects.toThrow('Failed to generate master key')
        })
    })

    test('throws for algo25 when createAlgo25Key fails', async () => {
        kmsMock.createAlgo25Key.mockRejectedValueOnce(
            new Error('Algo25 creation failed'),
        )

        const { result } = renderHook(() => useCreateAccount())

        await act(async () => {
            await expect(
                result.current.createAlgo25WalletAccount({
                    id: 'WALLET1',
                }),
            ).rejects.toThrow('Algo25 creation failed')
        })
    })

    test('creates algo25 account from existing key', async () => {
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: KeyType.Algo25Key,
            publicKey: 'ALGO25_PUBLIC_KEY',
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useCreateAccount())

        let created: any
        await act(async () => {
            created = await result.current.createAlgo25WalletAccount({
                id: 'WALLET1',
            })
        })

        expect(created.type).toBe('algo25')
        expect(created.address).toBe('ALGO25_PUBLIC_KEY')
        expect(created.keyPairId).toBe('WALLET1')
    })
})
