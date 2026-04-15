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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverAccounts, discoverRekeyedAccounts } from '../account-discovery'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import type { KMSHDWalletSession } from '@perawallet/wallet-core-kms'

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 0 },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(
        (bytes: Uint8Array) => `ADDRESS_${bytes[0]}_${bytes[1]}`,
    ),
    getAlgorandClient: vi.fn(),
    useNetworkStore: {
        getState: vi.fn(() => ({ network: 'testnet' })),
    },
}))

const mockFetchAccountFastLookup = vi.fn()
vi.mock('@perawallet/wallet-core-shared', () => ({
    generateOrderedUniqueId: vi.fn(() => Math.random().toString(36)),
    fetchAccountFastLookup: (...args: unknown[]) =>
        mockFetchAccountFastLookup(...args),
}))

const createMockSession = (): KMSHDWalletSession => ({
    getPublicKey: vi.fn(
        async (params: { account: number; keyIndex: number }) =>
            new Uint8Array([params.account, params.keyIndex]),
    ),
    signTransaction: vi.fn(),
    signData: vi.fn(),
    getMnemonic: vi.fn(),
})

describe('discoverAccounts', () => {
    const derivationType = BIP32DerivationType.Peikert

    beforeEach(() => {
        vi.clearAllMocks()
    })

    const createMockFastLookupResponse = (
        addresses: string[],
        existingAddresses: Set<string>,
    ) => {
        return addresses.map(addr => ({
            address: addr,
            accountExists: existingAddresses.has(addr),
        }))
    }

    it('should find accounts with activity and return them in sorted order', async () => {
        mockFetchAccountFastLookup.mockResolvedValue(
            createMockFastLookupResponse(
                ['ADDRESS_0_0', 'ADDRESS_0_1', 'ADDRESS_0_2'],
                new Set(['ADDRESS_0_0', 'ADDRESS_0_2']),
            ),
        )

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 2,
            accountGapLimit: 1,
        })

        expect(accounts).toHaveLength(2)
        expect(accounts[0].address).toBe('ADDRESS_0_0')
        expect(accounts[0].hdWalletDetails.account).toBe(0)
        expect(accounts[0].hdWalletDetails.keyIndex).toBe(0)
        expect(accounts[1].address).toBe('ADDRESS_0_2')
        expect(accounts[1].hdWalletDetails.account).toBe(0)
        expect(accounts[1].hdWalletDetails.keyIndex).toBe(2)
    })

    it('should sort accounts by account index first, then by key index', async () => {
        mockFetchAccountFastLookup.mockResolvedValue([
            { address: 'ADDRESS_1_0', accountExists: true },
            { address: 'ADDRESS_0_0', accountExists: true },
            { address: 'ADDRESS_0_1', accountExists: true },
            { address: 'ADDRESS_1_1', accountExists: true },
            { address: 'ADDRESS_0_2', accountExists: true },
        ])

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 5,
            accountGapLimit: 5,
        })

        expect(accounts).toHaveLength(5)
        expect(accounts[0].address).toBe('ADDRESS_0_0')
        expect(accounts[1].address).toBe('ADDRESS_0_1')
        expect(accounts[2].address).toBe('ADDRESS_0_2')
        expect(accounts[3].address).toBe('ADDRESS_1_0')
        expect(accounts[4].address).toBe('ADDRESS_1_1')
    })

    it('should stop after account gap limit', async () => {
        let callCount = 0
        mockFetchAccountFastLookup.mockImplementation(async addresses => {
            callCount++
            const hasActivity = addresses.some(
                addr => addr === 'ADDRESS_0_0' || addr === 'ADDRESS_2_0',
            )
            return addresses.map(addr => ({
                address: addr,
                accountExists: hasActivity,
            }))
        })

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountGapLimit: 5,
            keyIndexGapLimit: 1,
        })

        expect(accounts.length).toBeGreaterThan(0)
    })

    it('should return first account if no activity found', async () => {
        mockFetchAccountFastLookup.mockResolvedValue([
            { address: 'ADDRESS_0_0', accountExists: false },
        ])

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountGapLimit: 2,
            keyIndexGapLimit: 2,
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).toBe('ADDRESS_0_0')
        expect(accounts[0].hdWalletDetails.account).toBe(0)
        expect(accounts[0].hdWalletDetails.keyIndex).toBe(0)
    })

    it('should use batch API for account activity checks', async () => {
        const addressesChecked: string[] = []
        mockFetchAccountFastLookup.mockImplementation(async addresses => {
            addressesChecked.push(...addresses)
            return addresses.map(addr => ({ address, accountExists: false }))
        })

        const session = createMockSession()
        await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountGapLimit: 2,
            keyIndexGapLimit: 3,
        })

        expect(mockFetchAccountFastLookup).toHaveBeenCalled()
        const calls = mockFetchAccountFastLookup.mock.calls
        expect(calls.length).toBeGreaterThan(0)
    })
})

describe('discoverRekeyedAccounts', () => {
    const derivationType = BIP32DerivationType.Peikert
    const mockGetAlgorandClient = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getAlgorandClient).mockReturnValue({
            client: {
                indexer: {
                    searchForAccounts: vi.fn(),
                },
            },
        } as any)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should find rekeyed accounts', async () => {
        const mockSearchForAccounts = vi
            .fn()
            .mockImplementation(async params => {
                if (params && params.authAddr === 'ADDRESS_0_0') {
                    return {
                        accounts: [{ address: 'REKEYED_ACC_1' }],
                    }
                }
                return { accounts: [] }
            })

        vi.mocked(getAlgorandClient).mockReturnValue({
            client: {
                indexer: {
                    searchForAccounts: mockSearchForAccounts,
                },
            },
        } as any)

        const session = createMockSession()
        const accounts = await discoverRekeyedAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 1,
            accountGapLimit: 1,
        })

        expect(accounts[0].account.address).toBe('REKEYED_ACC_1')
        expect(accounts[0].authAddress).toBe('ADDRESS_0_0')
    })

    it('should use provided accountAddresses instead of HD derivation', async () => {
        const mockSearchForAccounts = vi
            .fn()
            .mockImplementation(async params => {
                if (params && params.authAddr === 'EXPLICIT_ADDRESS') {
                    return {
                        accounts: [{ address: 'REKEYED_FROM_EXPLICIT' }],
                    }
                }
                return { accounts: [] }
            })

        vi.mocked(getAlgorandClient).mockReturnValue({
            client: {
                indexer: {
                    searchForAccounts: mockSearchForAccounts,
                },
            },
        } as any)

        const session = createMockSession()
        const accounts = await discoverRekeyedAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountAddresses: ['EXPLICIT_ADDRESS', 'OTHER_ADDRESS'],
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].account.address).toBe('REKEYED_FROM_EXPLICIT')
        expect(accounts[0].authAddress).toBe('EXPLICIT_ADDRESS')
    })
})
