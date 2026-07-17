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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    discoverAccounts,
    discoverRekeyedAccounts,
    fetchRekeyedAddresses,
    type GetPublicKey,
} from '../account-discovery'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 0 },
    KeyContext: { Address: 0 },
    XHDWalletAPI: class {},
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
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        generateOrderedUniqueId: vi.fn(() => Math.random().toString(36)),
        fetchAccountFastLookup: (...args: unknown[]) =>
            mockFetchAccountFastLookup(...args),
    }
})

vi.mock('@perawallet/wallet-core-kms', () => ({
    hdDerivedKeyId: (
        seedKeyId: string,
        account: number,
        keyIndex: number,
        derivationType: number,
    ) => `${seedKeyId}-acc${account}-idx${keyIndex}-dt${derivationType}`,
}))

const createMockGetPublicKey = (): GetPublicKey =>
    vi.fn(
        async (params: { account: number; keyIndex: number }) =>
            new Uint8Array([params.account, params.keyIndex]),
    )

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

        const accounts = await discoverAccounts({
            getPublicKey: createMockGetPublicKey(),
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

        const accounts = await discoverAccounts({
            getPublicKey: createMockGetPublicKey(),
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
            getPublicKey: createMockGetPublicKey(),
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

        const accounts = await discoverAccounts({
            getPublicKey: createMockGetPublicKey(),
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
            return addresses.map((addr: string) => ({
                address: addr,
                accountExists: false,
            }))
        })

        await discoverAccounts({
            getPublicKey: createMockGetPublicKey(),
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
    // algosdk v9: `indexer.searchAccounts().authAddr(a).nextToken(t).do()`.
    // The factory returns a builder that records the chained `authAddr`/
    // `nextToken` args (so the per-auth-addr and pagination assertions keep
    // working) and delegates `.do()` to the supplied data fn. `calls` mirrors
    // the old `searchForAccounts` call log: one entry per `.do()`, carrying the
    // builder's `authAddr`/`next` so existing call-arg assertions translate.
    type SearchDataFn = (params: {
        authAddr?: string
        next?: string
    }) => Promise<{ accounts: { address: string }[]; nextToken?: string }>

    const makeSearchAccounts = (dataFn: SearchDataFn) => {
        const searchAccounts = vi.fn(() => {
            const chain: { authAddr?: string; next?: string } = {}
            const builder = {
                authAddr: (value: string) => {
                    chain.authAddr = value
                    return builder
                },
                nextToken: (value: string) => {
                    chain.next = value
                    return builder
                },
                do: () => {
                    searchAccounts.calls.push({ ...chain })
                    return dataFn(chain)
                },
            }
            return builder
        }) as ReturnType<typeof vi.fn> & {
            calls: { authAddr?: string; next?: string }[]
        }
        searchAccounts.calls = []
        return searchAccounts
    }

    const installIndexer = (searchAccounts: ReturnType<typeof vi.fn>) => {
        vi.mocked(getAlgorandClient).mockReturnValue({
            client: { indexer: { searchAccounts } },
        } as any)
    }

    beforeEach(() => {
        vi.clearAllMocks()
        installIndexer(makeSearchAccounts(async () => ({ accounts: [] })))
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('scans every provided address and labels results with it', async () => {
        const searchAccounts = makeSearchAccounts(async params =>
            params.authAddr === 'EXPLICIT_ADDRESS'
                ? { accounts: [{ address: 'REKEYED_FROM_EXPLICIT' }] }
                : { accounts: [] },
        )
        installIndexer(searchAccounts)

        const accounts = await discoverRekeyedAccounts({
            accountAddresses: ['EXPLICIT_ADDRESS', 'OTHER_ADDRESS'],
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).toBe('REKEYED_FROM_EXPLICIT')
        expect(accounts[0].rekeyAddress).toBe('EXPLICIT_ADDRESS')
        expect(searchAccounts.calls.map(c => c.authAddr)).toEqual([
            'EXPLICIT_ADDRESS',
            'OTHER_ADDRESS',
        ])
    })

    it('follows the indexer pagination token across pages', async () => {
        let page = 0
        const searchAccounts = makeSearchAccounts(async () => {
            page += 1
            return page === 1
                ? {
                      accounts: [{ address: 'REKEYED_PAGE_1' }],
                      nextToken: 'token-1',
                  }
                : { accounts: [{ address: 'REKEYED_PAGE_2' }] }
        })
        installIndexer(searchAccounts)

        const addresses = await fetchRekeyedAddresses('AUTH_ADDRESS', 'mainnet')

        expect(addresses).toEqual(['REKEYED_PAGE_1', 'REKEYED_PAGE_2'])
        expect(searchAccounts.calls).toHaveLength(2)
        expect(searchAccounts.calls[1]).toMatchObject({ next: 'token-1' })
    })

    it('logs a warning when the scan stops at the page cap', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        let page = 0
        // Never-ending pagination: every page returns a next token.
        const searchAccounts = makeSearchAccounts(async () => {
            page += 1
            return {
                accounts: [{ address: `REKEYED_PAGE_${page}` }],
                nextToken: `token-${page}`,
            }
        })
        installIndexer(searchAccounts)

        const addresses = await fetchRekeyedAddresses('AUTH_ADDRESS', 'mainnet')

        // MAX_REKEYED_SCAN_PAGES = 20
        expect(addresses).toHaveLength(20)
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('page cap'),
            expect.objectContaining({ address: 'AUTH_ADDRESS', pages: 20 }),
        )
    })

    it('propagates indexer errors instead of returning an empty result', async () => {
        const indexerError = new Error('indexer unreachable')
        installIndexer(makeSearchAccounts(() => Promise.reject(indexerError)))

        await expect(
            fetchRekeyedAddresses('AUTH_ADDRESS', 'mainnet'),
        ).rejects.toThrow('indexer unreachable')
    })
})
