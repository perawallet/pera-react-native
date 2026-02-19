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

import { describe, it, expect, vi } from 'vitest'
import { discoverAccounts, discoverRekeyedAccounts } from '../account-discovery'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import type { KMSHDWalletSession } from '@perawallet/wallet-core-kms'

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 0 },
}))

// Mock encodeAlgorandAddress to return string representation of bytes
const mockGetAlgorandClient = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(
        (bytes: Uint8Array) => `ADDRESS_${bytes[0]}_${bytes[1]}`,
    ),
    getAlgorandClient: () => mockGetAlgorandClient(),
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

    const createMockAlgorandClient = (
        checkActivity: (address: string) => boolean,
    ) => {
        return {
            client: {
                algod: {
                    accountInformation: vi
                        .fn()
                        .mockImplementation(async (address: string) => {
                            const hasActivity = checkActivity(address)
                            if (!hasActivity) {
                                throw new Error('404')
                            }
                            return {
                                amount: 1000,
                                assets: [],
                                appsLocalState: [],
                                appsTotalSchema: {
                                    numUints: 0,
                                    numByteSlices: 0,
                                },
                            }
                        }),
                },
            },
        } as any
    }

    it('should find accounts with activity', async () => {
        mockGetAlgorandClient.mockReturnValue(
            createMockAlgorandClient(address => {
                // Simulate activity for 0/0 and 0/2
                return address === 'ADDRESS_0_0' || address === 'ADDRESS_0_2'
            }),
        )

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 2,
            accountGapLimit: 1,
        })

        // We expect 0/0 and 0/2
        expect(accounts).toHaveLength(2)
        expect(accounts[0].address).toBe('ADDRESS_0_0')
        expect(accounts[1].address).toBe('ADDRESS_0_2')
    })

    it('should stop after account gap limit', async () => {
        mockGetAlgorandClient.mockReturnValue(
            createMockAlgorandClient(address => {
                // Activity on 0/0 and 2/0 (skipping account 1)
                return address === 'ADDRESS_0_0' || address === 'ADDRESS_2_0'
            }),
        )

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountGapLimit: 5,
            keyIndexGapLimit: 1,
        })

        expect(accounts).toHaveLength(2)
        expect(accounts[0].address).toBe('ADDRESS_0_0')
        expect(accounts[1].address).toBe('ADDRESS_2_0')
    })

    it('should find all active accounts', async () => {
        mockGetAlgorandClient.mockReturnValue(
            createMockAlgorandClient(address => {
                // Simulate activity for first 6 accounts (0..5) keys 0
                const parts = address.split('_')
                const account = parseInt(parts[1])
                const key = parseInt(parts[2])
                return key === 0 && account <= 10
            }),
        )

        const session = createMockSession()
        const accounts = await discoverAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountGapLimit: 5,
            keyIndexGapLimit: 1,
        })

        // Accounts 0..10 are found.
        expect(accounts).toHaveLength(11)
        expect(accounts[0].hdWalletDetails.account).toBe(0)
        expect(accounts[10].hdWalletDetails.account).toBe(10)
    })

    it('should return first account if no activity found', async () => {
        mockGetAlgorandClient.mockReturnValue(
            createMockAlgorandClient(() => false),
        )

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
})

describe('discoverRekeyedAccounts', () => {
    const derivationType = BIP32DerivationType.Peikert

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

        mockGetAlgorandClient.mockReturnValue({
            client: {
                indexer: {
                    searchForAccounts: mockSearchForAccounts,
                },
            },
        })

        const session = createMockSession()
        const accounts = await discoverRekeyedAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 1,
            accountGapLimit: 1,
        })

        expect(accounts[0].address).toBe('REKEYED_ACC_1')
        expect(accounts[0].rekeyAddress).toBe('ADDRESS_0_0')
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

        mockGetAlgorandClient.mockReturnValue({
            client: {
                indexer: {
                    searchForAccounts: mockSearchForAccounts,
                },
            },
        })

        const session = createMockSession()
        const accounts = await discoverRekeyedAccounts({
            session,
            derivationType,
            walletKeyId: 'test-wallet',
            accountAddresses: ['EXPLICIT_ADDRESS', 'OTHER_ADDRESS'],
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).toBe('REKEYED_FROM_EXPLICIT')
        expect(accounts[0].rekeyAddress).toBe('EXPLICIT_ADDRESS')
    })
})
