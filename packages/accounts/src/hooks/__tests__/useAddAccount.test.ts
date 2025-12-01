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
import { useAddAccount } from '../useAddAccount'
import { useAccountsStore } from '../../store'
import {
    registerTestPlatform,
    MemoryKeyValueStorage,
} from '@perawallet/wallet-core-platform-integration'
import type { WalletAccount } from '../../models'
import { BIP32DerivationTypes } from '@perawallet/wallet-core-xhdwallet'

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

const mockMutateAsync = vi.fn(async () => ({}))
const mockDeriveKey = vi.fn()

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
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
        useDeviceID: vi.fn(() => 'device-id'),
        useUpdateDeviceMutation: vi.fn(() => ({
            mutateAsync: mockMutateAsync,
        })),
    }
})

vi.mock('../useHDWallet', () => ({
    useHDWallet: () => ({
        deriveKey: mockDeriveKey,
    }),
}))

describe('useAddAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
    })

    test('adds standard account to store and syncs with backend', () => {
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

        const { result } = renderHook(() => useAddAccount())

        const account: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE_ADDRESS',
            canSign: true,
        }

        act(() => {
            result.current(account)
        })

        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toEqual([account])
        expect(dummySecure.setItem).not.toHaveBeenCalled()

        // Verify backend sync was called
        expect(mockMutateAsync).toHaveBeenCalledWith({
            deviceId: 'device-id',
            data: {
                platform: expect.any(String),
                accounts: ['ALICE_ADDRESS'],
            },
        })
    })

    test('adds multiple accounts to store', () => {
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

        const { result } = renderHook(() => useAddAccount())

        const account1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ADDR1',
            canSign: true,
        }

        const account2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'watch',
            address: 'ADDR2',
            canSign: false,
        }

        act(() => {
            result.current(account1)
        })

        act(() => {
            result.current(account2)
        })

        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toHaveLength(2)
        expect(accounts).toEqual([account1, account2])
    })

    test('derives keys and stores private key for HD wallet accounts', async () => {
        const mockSeed = Buffer.from(
            'test-seed-data-0123456789abcdef',
        ).toString('base64')
        const mockPrivateKey = new Uint8Array(64).fill(42)
        const mockPublicKey = new Uint8Array(32).fill(84)

        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async (key: string) => {
                if (key === 'rootkey-hd-wallet-123') {
                    return Buffer.from(JSON.stringify({ seed: mockSeed }))
                }
                return null
            }),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        mockDeriveKey.mockResolvedValue({
            address: mockPublicKey,
            privateKey: mockPrivateKey,
        })

        const { result } = renderHook(() => useAddAccount())

        const hdAccount: WalletAccount = {
            name: 'HD Account 1',
            type: 'standard',
            address: '', // Will be set by the hook
            canSign: true,
            hdWalletDetails: {
                walletId: 'hd-wallet-123',
                account: 0,
                change: 0,
                keyIndex: 5,
                derivationType: BIP32DerivationTypes.Peikert,
            },
        }

        await act(async () => {
            await result.current(hdAccount)
        })

        // Verify deriveKey was called with correct parameters
        expect(mockDeriveKey).toHaveBeenCalledWith({
            seed: Buffer.from(mockSeed, 'base64'),
            account: 0,
            keyIndex: 5,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        // Verify account was added to store with generated address and id
        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).toBeTruthy()
        expect(accounts[0].id).toBeTruthy()
        expect(accounts[0].name).toBe('HD Account 1')

        // Verify private key was stored in secure storage
        expect(dummySecure.setItem).toHaveBeenCalled()
        const setItemCall = dummySecure.setItem.mock.calls[0]
        expect(setItemCall.at(0)).toContain('pk-')
    })

    test('throws error when root key not found for HD wallet', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async () => null), // No key found
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { result } = renderHook(() => useAddAccount())

        const hdAccount: WalletAccount = {
            name: 'HD Account',
            type: 'standard',
            address: '',
            canSign: true,
            hdWalletDetails: {
                walletId: 'missing-wallet',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: BIP32DerivationTypes.Peikert,
            },
        }

        await expect(async () => {
            await act(async () => {
                await result.current(hdAccount)
            })
        }).rejects.toThrow('No key found for missing-wallet')
    })

    test('throws error when master key has no seed property', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => {}),
            getItem: vi.fn(async (key: string) => {
                if (key === 'rootkey-bad-wallet') {
                    return Buffer.from(
                        JSON.stringify({ invalidProperty: true }),
                    )
                }
                return null
            }),
            removeItem: vi.fn(async () => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { result } = renderHook(() => useAddAccount())

        const hdAccount: WalletAccount = {
            name: 'HD Account',
            type: 'standard',
            address: '',
            canSign: true,
            hdWalletDetails: {
                walletId: 'bad-wallet',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: BIP32DerivationTypes.Peikert,
            },
        }

        await expect(async () => {
            await act(async () => {
                await result.current(hdAccount)
            })
        }).rejects.toThrow('No key found for bad-wallet')
    })
})
