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
import { discoverAccounts } from '../accountDiscovery'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

// Mock the API to avoid actual key generation which might be slow or require wasm
vi.mock('@algorandfoundation/xhd-wallet-api', () => {
    class MockAPI {
        keyGen = vi.fn((_root, _ctx, account, keyIndex) => {
            // Return Uint8Array to match real API (mocking the bytes logic)
            return Promise.resolve(new Uint8Array([account, keyIndex]))
        })
    }

    return {
        XHDWalletAPI: MockAPI,
        fromSeed: vi.fn(),
        KeyContext: { Address: 0 },
        BIP32DerivationType: { Peikert: 0 },
    }
})

// Mock encodeAlgorandAddress to return string representation of bytes
const mockGetAlgorandClient = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(
        (bytes: Uint8Array) => `ADDRESS_${bytes[0]}_${bytes[1]}`,
    ),
    getAlgorandClient: () => mockGetAlgorandClient(),
}))

describe('discoverAccounts', () => {
    const seed = Buffer.from('test-seed')
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

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            walletId: 'test-wallet',
            keyIndexGapLimit: 2,
            accountGapLimit: 1,
        })

        // Account 0 check:
        // 0/0: Skipped (root).
        // 0/1: Inactive. Gap=1.
        // 0/2: Active. Gap=0. Found.
        // ...

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

        // 0/0 Active. Found. Gap 0.
        // Account 1 inactive -> gap 1.
        // Account 2/0 active -> Found. Gap 0.

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            walletId: 'test-wallet',
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
                // address format is ADDRESS_accountIndex_keyIndex
                const parts = address.split('_')
                const account = parseInt(parts[1])
                const key = parseInt(parts[2])
                // Only key 0 active for accounts
                return key === 0 && account <= 10
            }),
        )

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            walletId: 'test-wallet',
            accountGapLimit: 5,
            keyIndexGapLimit: 1,
        })

        // Accounts 0..10 are found.
        // Total 11 accounts found.
        expect(accounts).toHaveLength(11)
        expect(accounts[0].hdWalletDetails.account).toBe(0)
        expect(accounts[10].hdWalletDetails.account).toBe(10)
        expect(accounts[10].hdWalletDetails.account).toBe(10)
    })

    it('should return first account if no activity found', async () => {
        mockGetAlgorandClient.mockReturnValue(
            createMockAlgorandClient(() => false),
        )

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            walletId: 'test-wallet',
            accountGapLimit: 2,
            keyIndexGapLimit: 2,
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).toBe('ADDRESS_0_0')
        expect(accounts[0].hdWalletDetails.account).toBe(0)
        expect(accounts[0].hdWalletDetails.keyIndex).toBe(0)
    })
})
