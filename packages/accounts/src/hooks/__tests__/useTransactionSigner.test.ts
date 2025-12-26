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
import { renderHook } from '@testing-library/react'
import { useTransactionSigner } from '../useTransactionSigner'
import { useAccountsStore } from '../../store'
import {
    registerTestPlatform,
    MemoryKeyValueStorage,
} from '@perawallet/wallet-core-platform-integration'
import type { WalletAccount } from '../../models'
import { NoHDWalletError } from '../../errors'
import { KeyNotFoundError } from '@perawallet/wallet-core-kmd'

// Mock store
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

// Mock HDWallet
const mockSignTransaction = vi.fn((_, __, ___) => {
    return Promise.resolve(new Uint8Array([1, 2, 3]))
})
vi.mock('../useHDWallet', () => ({
    useHDWallet: vi.fn(() => ({
        signTransaction: mockSignTransaction,
    })),
}))

// Mock platform integration
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
    }
})

describe('useTransactionSigner', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
    })

    test('signTransactionForAddress signs transaction if account and keys exist', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
        }
        useAccountsStore.setState({ accounts: [account] })

        mockSignTransaction.mockResolvedValue(new Uint8Array([1, 2, 3]))

        const { result } = renderHook(() => useTransactionSigner())

        const txn = Buffer.from('txn')
        const signed = await result.current.signTransactionForAddress(
            'ADDR1',
            txn,
        )

        expect(signed).toEqual(new Uint8Array([1, 2, 3]))
        expect(dummySecure.getItem).toHaveBeenCalledWith('rootkey-W1')
        // Check that signTransaction was called.
        // Note: We cannot check the exact seed buffer content here because it gets zeroed out by withKey
        // before the test expectation runs.
        expect(mockSignTransaction).toHaveBeenCalled()
        expect(mockSignTransaction.mock.calls[0][1]).toEqual(
            account.hdWalletDetails,
        )
        expect(mockSignTransaction.mock.calls[0][2]).toEqual(txn)
    })

    test('signTransactionForAddress throws if account not found', async () => {
        const { result } = renderHook(() => useTransactionSigner())
        await expect(
            result.current.signTransactionForAddress(
                'ADDR1',
                Buffer.from('txn'),
            ),
        ).rejects.toThrow(NoHDWalletError)
    })

    test('signTransactionForAddress throws if account has no HD wallet details', async () => {
        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
            // No hdWalletDetails
        }
        useAccountsStore.setState({ accounts: [account] })

        const { result } = renderHook(() => useTransactionSigner())

        await expect(
            result.current.signTransactionForAddress(
                'ADDR1',
                Buffer.from('txn'),
            ),
        ).rejects.toThrow(NoHDWalletError)
    })

    test('signTransactionForAddress throws if no signing keys found in storage', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null), // Returns null
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
        }
        useAccountsStore.setState({ accounts: [account] })

        const { result } = renderHook(() => useTransactionSigner())

        await expect(
            result.current.signTransactionForAddress(
                'ADDR1',
                Buffer.from('txn'),
            ),
        ).rejects.toThrow(KeyNotFoundError) // KMD error
    })

    test('signTransactionForAddress handles JSON format master key', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () =>
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('seed_data').toString('base64'),
                        entropy: 'entropy_data',
                    }),
                ),
            ),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
        }
        useAccountsStore.setState({ accounts: [account] })

        mockSignTransaction.mockResolvedValue(new Uint8Array([1, 2, 3]))

        const { result } = renderHook(() => useTransactionSigner())

        const txn = Buffer.from('txn')
        const signed = await result.current.signTransactionForAddress(
            'ADDR1',
            txn,
        )

        expect(signed).toEqual(new Uint8Array([1, 2, 3]))
        expect(mockSignTransaction).toHaveBeenCalled()
    })

    test('signTransactionForAddress throws if signTransaction fails', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
        }
        useAccountsStore.setState({ accounts: [account] })

        mockSignTransaction.mockRejectedValue(new Error('Signing failed'))

        const { result } = renderHook(() => useTransactionSigner())

        await expect(
            result.current.signTransactionForAddress(
                'ADDR1',
                Buffer.from('txn'),
            ),
        ).rejects.toThrow('Signing failed')
    })

    test('signTransactionForAddress handles storage retrieval error', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => {
                throw new Error('Storage access denied')
            }),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
        }
        useAccountsStore.setState({ accounts: [account] })

        const { result } = renderHook(() => useTransactionSigner())

        await expect(
            result.current.signTransactionForAddress(
                'ADDR1',
                Buffer.from('txn'),
            ),
        ).rejects.toThrow('Storage access denied')
    })

    test('signTransactionForAddress finds account by address correctly', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account1: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Acc1',
            keyPairId: 'rootkey-W1',
        }

        const account2: WalletAccount = {
            id: '2',
            address: 'ADDR2',
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W2',
                account: 1,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
            },
            name: 'Acc2',
            keyPairId: 'rootkey-W2',
        }

        useAccountsStore.setState({ accounts: [account1, account2] })

        mockSignTransaction.mockResolvedValue(new Uint8Array([1, 2, 3]))

        const { result } = renderHook(() => useTransactionSigner())

        const txn = Buffer.from('txn')
        await result.current.signTransactionForAddress('ADDR2', txn)

        // Verify it used the correct account's wallet ID
        expect(dummySecure.getItem).toHaveBeenCalledWith('rootkey-W2')
        expect(mockSignTransaction.mock.calls[0][1]).toEqual(
            account2.hdWalletDetails,
        )
    })
})
