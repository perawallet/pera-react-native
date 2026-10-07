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
import { getAlgorandClient } from '../../blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import {
    checkAlgorandActivity,
    fetchAlgorandRekeyedAddresses,
} from '../discovery'

vi.mock('../../blockchain', async importOriginal => ({
    ...(await importOriginal<object>()),
    getAlgorandClient: vi.fn(),
}))

const mockFetchAccountFastLookup = vi.fn()
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        fetchAccountFastLookup: (...args: unknown[]) =>
            mockFetchAccountFastLookup(...args),
    }
})

describe('checkAlgorandActivity', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('maps the fast-lookup answer per address on the given network', async () => {
        mockFetchAccountFastLookup.mockResolvedValue([
            { address: 'A', accountExists: true },
            { address: 'B', accountExists: false },
        ])

        const activity = await checkAlgorandActivity(['A', 'B'], 'testnet')

        expect(mockFetchAccountFastLookup).toHaveBeenCalledWith(
            ['A', 'B'],
            'testnet',
        )
        expect(activity).toEqual(
            new Map([
                ['A', true],
                ['B', false],
            ]),
        )
    })

    it('reads a failed probe as inactive instead of rejecting', async () => {
        vi.spyOn(logger, 'warn').mockImplementation(() => {})
        mockFetchAccountFastLookup.mockRejectedValue(new Error('offline'))

        const activity = await checkAlgorandActivity(['A', 'B'], 'mainnet')

        expect(activity).toEqual(
            new Map([
                ['A', false],
                ['B', false],
            ]),
        )
    })
})

describe('fetchAlgorandRekeyedAddresses', () => {
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

        const addresses = await fetchAlgorandRekeyedAddresses(
            'AUTH_ADDRESS',
            'mainnet',
        )

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

        const addresses = await fetchAlgorandRekeyedAddresses(
            'AUTH_ADDRESS',
            'mainnet',
        )

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
            fetchAlgorandRekeyedAddresses('AUTH_ADDRESS', 'mainnet'),
        ).rejects.toThrow('indexer unreachable')
    })
})
