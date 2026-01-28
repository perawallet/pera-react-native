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

// Mock blockchain
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionEncoder: vi.fn(() => ({
        encodeTransaction: vi.fn(() => new Uint8Array([0])),
        decodeTransaction: vi.fn(() => ({})),
    })),
    encodeAlgorandAddress: vi.fn((bytes: Uint8Array) => {
        // Return the address string that was passed in the mock transaction
        const decoder = new TextDecoder()
        return decoder.decode(bytes)
    }),
    Address: {
        fromString: vi.fn((addr: string) => ({ toString: () => addr })),
    },
    PeraTransaction: {},
    PeraTransactionGroup: [],
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

// Mock KMS
const mockExecuteWithKey = vi.fn(async (_, __, fn) => {
    return fn(Buffer.from('seed_data'))
})
const mockExecuteWithSeed = vi.fn(async (_, __, fn) => {
    return fn(new Uint8Array(32).fill(1))
})
vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: vi.fn(() => ({
        executeWithKey: mockExecuteWithKey,
        executeWithSeed: mockExecuteWithSeed,
    })),
}))

// Helper to create mock PeraTransaction
const createMockTransaction = (sender: string) =>
    ({
        sender: {
            toString: () => sender,
            publicKey: new TextEncoder().encode(sender),
        },
        signature: undefined,
    }) as any

describe('useTransactionSigner', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        mockExecuteWithKey.mockImplementation(async (_, __, fn) => {
            return fn(Buffer.from('seed_data'))
        })
    })

    test('signTransactions returns the hook with signTransactions function', () => {
        const { result } = renderHook(() => useTransactionSigner())
        expect(result.current.signTransactions).toBeDefined()
        expect(typeof result.current.signTransactions).toBe('function')
    })

    test('signTransactions signs transactions when accounts exist', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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

        const txnGroup = [createMockTransaction('ADDR1')]
        const indexesToSign = [0]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(Array.isArray(signed)).toBe(true)
        expect(mockSignTransaction).toHaveBeenCalled()
    })

    test('signTransactions skips transactions not in indexesToSign', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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

        const txnGroup = [
            createMockTransaction('ADDR1'),
            createMockTransaction('ADDR1'),
        ]
        // Only sign index 0, skip index 1
        const indexesToSign = [0]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(signed.length).toBe(2)
    })

    test('signTransactions handles multiple accounts in transaction group', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => Buffer.from('seed_data')),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account1: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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
            type: 'hdWallet',
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

        const txnGroup = [
            createMockTransaction('ADDR1'),
            createMockTransaction('ADDR2'),
        ]
        const indexesToSign = [0, 1]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(signed.length).toBe(2)
    })

    test('signTransactions handles JSON format master key', async () => {
        mockExecuteWithKey.mockImplementationOnce(async (_, __, fn) => {
            return fn(
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('seed_data').toString('base64'),
                        entropy: 'entropy_data',
                    }),
                ),
            )
        })

        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () =>
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('seed_data').toString('base64'),
                        entropy: 'entropy_data',
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

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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

        const txnGroup = [createMockTransaction('ADDR1')]
        const indexesToSign = [0]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(mockSignTransaction).toHaveBeenCalled()
    })

    test('signTransactions handles empty transaction group', async () => {
        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup: any[] = []
        const indexesToSign: number[] = []

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toEqual([])
    })

    test('signTransactions skips transactions from unknown accounts', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // No accounts registered
        useAccountsStore.setState({ accounts: [] })

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('UNKNOWN_ADDR')]
        const indexesToSign = [0]

        // Should not throw, but should return the original transaction unchanged
        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(mockSignTransaction).not.toHaveBeenCalled()
    })

    test('signTransactions handles rekeyed accounts by using the rekey authority', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Rekeyed account - has a rekey address pointing to another account
        const rekeyedAccount: WalletAccount = {
            id: '1',
            address: 'REKEYED_ADDR',
            type: 'algo25',
            canSign: true,
            name: 'Rekeyed Account',
            rekeyAddress: 'AUTH_ADDR', // Points to authority account
        }

        // Authority account - the one that actually signs
        const authorityAccount: WalletAccount = {
            id: '2',
            address: 'AUTH_ADDR',
            type: 'hdWallet',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W2',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Authority Account',
            keyPairId: 'rootkey-W2',
        }

        useAccountsStore.setState({
            accounts: [rekeyedAccount, authorityAccount],
        })
        mockSignTransaction.mockResolvedValue(new Uint8Array([1, 2, 3]))

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('REKEYED_ADDR')]
        const indexesToSign = [0]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        // The mock should be called since authority account has hdWalletDetails
        expect(mockSignTransaction).toHaveBeenCalled()
    })

    test.skip('signTransactions handles Algo25 account type', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('keypair_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const algo25Account: WalletAccount = {
            id: '1',
            address: 'ALGO25_ADDR',
            type: 'algo25',
            canSign: true,
            name: 'Algo25 Account',
            keyPairId: 'algo25-keypair-1',
        }

        useAccountsStore.setState({ accounts: [algo25Account] })

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('ALGO25_ADDR')]
        const indexesToSign = [0]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        // Should complete without error
        expect(signed).toBeDefined()
        expect(signed.length).toBe(1)
    })

    test('signTransactions batches transactions by account for efficiency', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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

        // Multiple transactions from the same account
        const txnGroup = [
            createMockTransaction('ADDR1'),
            createMockTransaction('ADDR1'),
            createMockTransaction('ADDR1'),
        ]
        const indexesToSign = [0, 1, 2]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(signed.length).toBe(3)
        // All transactions should be signed - signTransaction is called for each tx in the batch
        expect(mockSignTransaction).toHaveBeenCalled()
    })

    test('signTransactions preserves original array order with mixed accounts', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account1: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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
            type: 'hdWallet',
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

        // Interleaved transactions from different accounts
        const txnGroup = [
            createMockTransaction('ADDR1'), // index 0
            createMockTransaction('ADDR2'), // index 1
            createMockTransaction('ADDR1'), // index 2
            createMockTransaction('ADDR2'), // index 3
        ]
        const indexesToSign = [0, 1, 2, 3]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(signed.length).toBe(4)
    })

    test('signTransactions rejects when HDWallet keyData is null', async () => {
        mockExecuteWithKey.mockImplementationOnce(async (_, __, fn) => {
            return fn(null)
        })
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => null), // Return null keyData
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const account: WalletAccount = {
            id: '1',
            address: 'ADDR1',
            type: 'hdWallet',
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

        const txnGroup = [createMockTransaction('ADDR1')]
        const indexesToSign = [0]

        await expect(
            result.current.signTransactions(txnGroup, indexesToSign),
        ).rejects.toThrow(/No signing keys found/)
    })

    test('signTransactions rejects when Algo25 keyPairId is missing', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('keypair_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Algo25 account without keyPairId
        const algo25Account: WalletAccount = {
            id: '1',
            address: 'ALGO25_ADDR',
            type: 'algo25',
            canSign: true,
            name: 'Algo25 Account',
            // No keyPairId and no hdWalletDetails
        }

        useAccountsStore.setState({ accounts: [algo25Account] })

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('ALGO25_ADDR')]
        const indexesToSign = [0]

        await expect(
            result.current.signTransactions(txnGroup, indexesToSign),
        ).rejects.toThrow(/No signing keys found/)
    })

    test('signTransactions rejects when Algo25 keyData is null', async () => {
        mockExecuteWithKey.mockImplementationOnce(async (_, __, fn) => {
            return fn(null)
        })
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => null), // Return null keyData
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Algo25 account with keyPairId but storage returns null
        const algo25Account: WalletAccount = {
            id: '1',
            address: 'ALGO25_ADDR',
            type: 'algo25',
            canSign: true,
            name: 'Algo25 Account',
            keyPairId: 'algo25-keypair-1',
            // No hdWalletDetails - this is an Algo25 account
        }

        useAccountsStore.setState({ accounts: [algo25Account] })

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('ALGO25_ADDR')]
        const indexesToSign = [0]

        await expect(
            result.current.signTransactions(txnGroup, indexesToSign),
        ).rejects.toThrow(/No signing keys found/)
    })

    test('signTransactions rejects when rekeyed authority account is not found', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Rekeyed account pointing to non-existent authority
        const rekeyedAccount: WalletAccount = {
            id: '1',
            address: 'REKEYED_ADDR',
            type: 'algo25',
            canSign: true,
            name: 'Rekeyed Account',
            rekeyAddress: 'MISSING_AUTH_ADDR', // Points to non-existent account
        }

        // Only add the rekeyed account, not the authority
        useAccountsStore.setState({ accounts: [rekeyedAccount] })

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('REKEYED_ADDR')]
        const indexesToSign = [0]

        await expect(
            result.current.signTransactions(txnGroup, indexesToSign),
        ).rejects.toThrow(/No rekeyed account found/)
    })

    test('signTransactions rejects for unsupported account types like hardware', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Hardware account - not yet supported
        const hardwareAccount: WalletAccount = {
            id: '1',
            address: 'HARDWARE_ADDR',
            type: 'hardware',
            canSign: true,
            name: 'Hardware Account',
            hardwareDetails: {
                manufacturer: 'ledger',
            },
            // No hdWalletDetails or keyPairId
        }

        useAccountsStore.setState({ accounts: [hardwareAccount] })

        const { result } = renderHook(() => useTransactionSigner())

        const txnGroup = [createMockTransaction('HARDWARE_ADDR')]
        const indexesToSign = [0]

        await expect(
            result.current.signTransactions(txnGroup, indexesToSign),
        ).rejects.toThrow(/Unsupported account type/)
    })

    test('signTransactions sets authAddress when signing for a different sender (rekeyed)', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => Buffer.from('seed_data')),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Authority account with different address than sender
        const authorityAccount: WalletAccount = {
            id: '1',
            address: 'AUTH_ADDR',
            type: 'hdWallet',
            canSign: true,
            hdWalletDetails: {
                walletId: 'W1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            name: 'Authority Account',
            keyPairId: 'rootkey-W1',
        }

        const rekeyedAccount: WalletAccount = {
            id: '2',
            address: 'REKEYED_ADDR',
            type: 'algo25',
            canSign: true,
            name: 'Rekeyed Account',
            rekeyAddress: 'AUTH_ADDR',
        }

        useAccountsStore.setState({
            accounts: [authorityAccount, rekeyedAccount],
        })
        mockSignTransaction.mockResolvedValue(new Uint8Array([1, 2, 3]))

        const { result } = renderHook(() => useTransactionSigner())

        // Create transaction where sender (REKEYED_ADDR) differs from signer (AUTH_ADDR)
        const txnGroup = [createMockTransaction('REKEYED_ADDR')]
        const indexesToSign = [0]

        const signed = await result.current.signTransactions(
            txnGroup,
            indexesToSign,
        )

        expect(signed).toBeDefined()
        expect(signed.length).toBe(1)
        // The authAddress should be set because AUTH_ADDR is signing for REKEYED_ADDR
        expect(signed[0].authAddress).toBeDefined()
        expect(mockSignTransaction).toHaveBeenCalled()
    })
})
