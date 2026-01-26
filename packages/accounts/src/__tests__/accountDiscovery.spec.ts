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
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(
        (bytes: Uint8Array) => `ADDRESS_${bytes[0]}_${bytes[1]}`,
    ),
}))

describe('discoverAccounts', () => {
    const seed = Buffer.from('test-seed')
    const derivationType = BIP32DerivationType.Peikert

    const createMockAlgorandClient = (checkActivity: (address: string) => boolean) => {
        return {
            client: {
                algod: {
                    accountInformation: vi.fn().mockImplementation(async (address: string) => {
                        const hasActivity = checkActivity(address);
                        if (!hasActivity) {
                            throw new Error('404');
                        }
                        return {
                            amount: 1000,
                            assets: [],
                            appsLocalState: [],
                            appsTotalSchema: { numUints: 0, numByteSlices: 0 },
                        };
                    }),
                },
            },
        } as any;
    };

    it('should find accounts with activity', async () => {
        const algorandClient = createMockAlgorandClient(address => {
            // Simulate activity for 0/0 and 0/2
            return address === 'ADDRESS_0_0' || address === 'ADDRESS_0_2'
        })

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            algorandClient,
            walletId: 'test-wallet',
            keyIndexGapLimit: 2,
            accountGapLimit: 1,
        })

        // Account 0 check:
        // 0/0: Skipped (root).
        // 0/1: Inactive. Gap=1.
        // 0/2: Active. Gap=0. Found.
        // ...

        // We expect only 0/2 because 0/0 is skipped
        expect(accounts).toHaveLength(1)
        expect(accounts[0]).toEqual({
            id: expect.any(String),
            address: 'ADDRESS_0_2',
            type: 'hdWallet',
            canSign: true,
            hdWalletDetails: {
                walletId: 'test-wallet',
                account: 0,
                change: 0,
                keyIndex: 2,
                derivationType,
            },
        })
    })

    it('should stop after account gap limit', async () => {
        const algorandClient = createMockAlgorandClient(address => {
            // Activity on 0/0 and 2/0 (skipping account 1)
            return address === 'ADDRESS_0_0' || address === 'ADDRESS_2_0'
        })

        // 0/0 skipped. Account 0 has no other activity -> considered inactive (gap 1).
        // Account 1 inactive -> gap 2.
        // Account 2/0 active -> Found. Gap 0.
        // ...

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            algorandClient,
            walletId: 'test-wallet',
            accountGapLimit: 5,
            keyIndexGapLimit: 1,
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).toBe('ADDRESS_2_0')
        expect(accounts[0].hdWalletDetails.account).toBe(2)
    })

    it('should find at most 5 active accounts', async () => {
        const algorandClient = createMockAlgorandClient(address => {
            // Simulate activity for first 6 accounts (0..5) keys 0
            // address format is ADDRESS_accountIndex_keyIndex
            const parts = address.split('_')
            const account = parseInt(parts[1])
            const key = parseInt(parts[2])
            // Only key 0 active for accounts
            return key === 0 && account <= 10
        })

        const accounts = await discoverAccounts({
            seed,
            derivationType,
            algorandClient,
            walletId: 'test-wallet',
            accountGapLimit: 5,
            keyIndexGapLimit: 1,
        })

        // Account 0/0 skipped. Account 0 has no other activity -> Gap 1.
        // Accounts 1, 2, 3, 4, 5 are found (key 0 active).
        // Total 5 accounts found.
        expect(accounts).toHaveLength(5)
        expect(accounts[0].hdWalletDetails.account).toBe(1)
        expect(accounts[4].hdWalletDetails.account).toBe(5)
    })
})
