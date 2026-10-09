/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverAccounts, discoverRekeyedAccounts } from '../account-discovery'
import type { GetPublicKey } from '../chain-adapter'
import { fakeAccountsChain, TESTNET_SCOPE } from './fakeAccountsChain'
import { addressOn, hdIndexOf, signingKeyOn } from '../credentials'
import type { WalletAccount } from '../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        generateOrderedUniqueId: vi.fn(() => Math.random().toString(36)),
    }
})

// The chain's activity probe takes the addresses and answers per address; the
// fast-lookup shape these specs were written against maps straight onto it.
const mockFetchAccountFastLookup = vi.fn()

const installFakeChain = () => {
    const { adapter, codec } = fakeAccountsChain()
    vi.mocked(codec.fromPublicKey).mockImplementation(
        (bytes: Uint8Array) => `ADDRESS_${bytes[0]}_${bytes[1]}`,
    )
    vi.mocked(adapter.checkActivity).mockImplementation(async addresses => {
        const results: { address: string; accountExists: boolean }[] =
            await mockFetchAccountFastLookup(addresses)
        return new Map(results.map(r => [r.address, r.accountExists]))
    })
}

const addressOf = (account: WalletAccount) => addressOn(account, TESTNET_SCOPE)

const createMockGetPublicKey = (): GetPublicKey =>
    vi.fn(
        async (params: { account: number; keyIndex: number }) =>
            new Uint8Array([params.account, params.keyIndex]),
    )

describe('discoverAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        installFakeChain()
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

        const accounts = await discoverAccounts({
            scope: TESTNET_SCOPE,
            getPublicKey: createMockGetPublicKey(),
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 2,
            accountGapLimit: 1,
        })

        expect(accounts).toHaveLength(2)
        expect(addressOf(accounts[0])).toBe('ADDRESS_0_0')
        expect(hdIndexOf(accounts[0])?.account).toBe(0)
        expect(hdIndexOf(accounts[0])?.keyIndex).toBe(0)
        expect(addressOf(accounts[1])).toBe('ADDRESS_0_2')
        expect(hdIndexOf(accounts[1])?.account).toBe(0)
        expect(hdIndexOf(accounts[1])?.keyIndex).toBe(2)
    })

    it('should sort accounts by account index first, then by key index', async () => {
        mockFetchAccountFastLookup.mockResolvedValue([
            { address: 'ADDRESS_1_0', accountExists: true },
            { address: 'ADDRESS_0_0', accountExists: true },
            { address: 'ADDRESS_0_1', accountExists: true },
            { address: 'ADDRESS_1_1', accountExists: true },
            { address: 'ADDRESS_0_2', accountExists: true },
        ])

        const accounts = await discoverAccounts({
            scope: TESTNET_SCOPE,
            getPublicKey: createMockGetPublicKey(),
            walletKeyId: 'test-wallet',
            keyIndexGapLimit: 5,
            accountGapLimit: 5,
        })

        expect(accounts).toHaveLength(5)
        expect(addressOf(accounts[0])).toBe('ADDRESS_0_0')
        expect(addressOf(accounts[1])).toBe('ADDRESS_0_1')
        expect(addressOf(accounts[2])).toBe('ADDRESS_0_2')
        expect(addressOf(accounts[3])).toBe('ADDRESS_1_0')
        expect(addressOf(accounts[4])).toBe('ADDRESS_1_1')
    })

    it('should stop after account gap limit', async () => {
        mockFetchAccountFastLookup.mockImplementation(async addresses => {
            const hasActivity = addresses.some(
                (addr: string) =>
                    addr === 'ADDRESS_0_0' || addr === 'ADDRESS_2_0',
            )
            return addresses.map((addr: string) => ({
                address: addr,
                accountExists: hasActivity,
            }))
        })

        const accounts = await discoverAccounts({
            scope: TESTNET_SCOPE,
            getPublicKey: createMockGetPublicKey(),
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

        const accounts = await discoverAccounts({
            scope: TESTNET_SCOPE,
            getPublicKey: createMockGetPublicKey(),
            walletKeyId: 'test-wallet',
            accountGapLimit: 2,
            keyIndexGapLimit: 2,
        })

        expect(accounts).toHaveLength(1)
        expect(addressOf(accounts[0])).toBe('ADDRESS_0_0')
        expect(hdIndexOf(accounts[0])?.account).toBe(0)
        expect(hdIndexOf(accounts[0])?.keyIndex).toBe(0)
    })

    it('stamps discovered accounts with an HD custody and their chain entry', async () => {
        mockFetchAccountFastLookup.mockResolvedValue([
            { address: 'ADDRESS_0_0', accountExists: false },
        ])

        const [account] = await discoverAccounts({
            scope: TESTNET_SCOPE,
            getPublicKey: createMockGetPublicKey(),
            walletKeyId: 'test-wallet',
            accountGapLimit: 2,
            keyIndexGapLimit: 2,
        })

        expect(account.custody).toEqual({
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        })
        expect(account.chains).toEqual({
            algorand: {
                address: 'ADDRESS_0_0',
                keyPairId: 'test-wallet-acc0-idx0-dt9',
            },
        })
        expect(signingKeyOn(account, 'algorand')).toBe(
            fakeAccountsChain().adapter.hdKeyPairId('test-wallet', {
                account: 0,
                keyIndex: 0,
            }),
        )
    })

    it('should use batch API for account activity checks', async () => {
        const addressesChecked: string[] = []
        mockFetchAccountFastLookup.mockImplementation(async addresses => {
            addressesChecked.push(...addresses)
            return addresses.map((addr: string) => ({
                address: addr,
                accountExists: false,
            }))
        })

        await discoverAccounts({
            scope: TESTNET_SCOPE,
            getPublicKey: createMockGetPublicKey(),
            walletKeyId: 'test-wallet',
            accountGapLimit: 2,
            keyIndexGapLimit: 3,
        })

        expect(fakeAccountsChain().adapter.checkActivity).toHaveBeenCalledWith(
            expect.any(Array),
            TESTNET_SCOPE,
        )
        const calls = mockFetchAccountFastLookup.mock.calls
        expect(calls.length).toBeGreaterThan(0)
    })
})

describe('discoverRekeyedAccounts', () => {
    it('scans every provided address on the active network and labels results with it', async () => {
        const fetchRekeyedAddresses = vi.mocked(
            fakeAccountsChain().adapter.fetchRekeyedAddresses!,
        )
        fetchRekeyedAddresses.mockImplementation(async authAddress =>
            authAddress === 'EXPLICIT_ADDRESS' ? ['REKEYED_FROM_EXPLICIT'] : [],
        )

        const accounts = await discoverRekeyedAccounts({
            accountAddresses: ['EXPLICIT_ADDRESS', 'OTHER_ADDRESS'],
            scope: TESTNET_SCOPE,
        })

        expect(accounts).toHaveLength(1)
        expect(addressOf(accounts[0])).toBe('REKEYED_FROM_EXPLICIT')
        expect(accounts[0].rekeyAddress).toBe('EXPLICIT_ADDRESS')
        expect(accounts[0].custody).toEqual({ kind: 'watch' })
        expect(accounts[0].chains).toEqual({
            algorand: { address: 'REKEYED_FROM_EXPLICIT' },
        })
        expect(fetchRekeyedAddresses.mock.calls).toEqual([
            ['EXPLICIT_ADDRESS', TESTNET_SCOPE],
            ['OTHER_ADDRESS', TESTNET_SCOPE],
        ])
    })
})
