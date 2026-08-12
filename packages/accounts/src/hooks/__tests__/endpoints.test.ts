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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
    CHART_QUERY_TIMEOUT_MS,
    queryClient,
} from '@perawallet/wallet-core-shared'
import { HOLDINGS_PAGE_LIMIT } from '../../constants'
import {
    fetchOnChainAccountInformation,
    getAccountsBalanceHistoryEndpointPath,
    fetchAccountsBalanceHistory,
    getAccountAssetBalanceHistoryEndpointPath,
    fetchAccountAssetBalanceHistory,
    fetchAccountAssetOptInRounds,
} from '../endpoints'

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: vi.fn(),
    CHART_QUERY_TIMEOUT_MS: 30_000,
}))

describe('endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('fetchOnChainAccountInformation', () => {
        it('calls algod.accountInformation with the given address', () => {
            // algosdk v9 builder: `accountInformation(addr).do()`.
            const mockDo = vi.fn().mockReturnValue('result')
            const mockAccountInformation = vi
                .fn()
                .mockReturnValue({ do: mockDo })
            const algokit = {
                client: {
                    algod: { accountInformation: mockAccountInformation },
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any

            const result = fetchOnChainAccountInformation(algokit, 'ADDR1')

            expect(mockAccountInformation).toHaveBeenCalledWith('ADDR1')
            expect(mockDo).toHaveBeenCalled()
            expect(result).toBe('result')
        })
    })

    describe('fetchAccountAssetOptInRounds', () => {
        it('paginates indexer holdings into an assetId to opt-in-round map, skipping roundless entries', async () => {
            // Indexer builder chain: `lookupAccountAssets(addr).limit(n).nextToken(t).do()`.
            const pages = [
                {
                    assets: [
                        { assetId: 10n, optedInAtRound: 100n },
                        { assetId: 15n, optedInAtRound: undefined },
                    ],
                    nextToken: 'tok1',
                },
                {
                    assets: [{ assetId: 20n, optedInAtRound: 200n }],
                    nextToken: undefined,
                },
            ]
            const limits: number[] = []
            const nextTokens: string[] = []
            const mockDo = vi.fn(() => Promise.resolve(pages.shift()))
            const mockLookupAccountAssets = vi.fn((_address: string) => {
                const builder = {
                    limit: vi.fn((value: number) => {
                        limits.push(value)
                        return builder
                    }),
                    nextToken: vi.fn((token: string) => {
                        nextTokens.push(token)
                        return builder
                    }),
                    do: mockDo,
                }
                return builder
            })
            const algokit = {
                client: {
                    indexer: { lookupAccountAssets: mockLookupAccountAssets },
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any

            const result = await fetchAccountAssetOptInRounds(algokit, 'ADDR1')

            expect(mockLookupAccountAssets).toHaveBeenCalledWith('ADDR1')
            expect(limits).toEqual([HOLDINGS_PAGE_LIMIT, HOLDINGS_PAGE_LIMIT])
            expect(nextTokens).toEqual(['tok1'])
            expect(result).toEqual(
                new Map([
                    ['10', 100],
                    ['20', 200],
                ]),
            )
        })
    })

    describe('getAccountsBalanceHistoryEndpointPath', () => {
        it('returns the wealth endpoint path', () => {
            expect(getAccountsBalanceHistoryEndpointPath()).toBe(
                '/v1/wallet/wealth/',
            )
        })
    })

    describe('fetchAccountsBalanceHistory', () => {
        it('sends a GET with addresses, period, and network and returns data', async () => {
            const payload = { items: [] }
            ;(queryClient as Mock).mockResolvedValue({ data: payload })

            const result = await fetchAccountsBalanceHistory(
                ['A', 'B'],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                '1W' as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'mainnet' as any,
            )

            expect(queryClient).toHaveBeenCalledWith({
                backend: 'pera',
                network: 'mainnet',
                method: 'GET',
                url: '/v1/wallet/wealth/',
                params: {
                    account_addresses: ['A', 'B'],
                    period: '1W',
                },
                timeout: CHART_QUERY_TIMEOUT_MS,
            })
            expect(result).toBe(payload)
        })
    })

    describe('getAccountAssetBalanceHistoryEndpointPath', () => {
        it('interpolates address and assetId', () => {
            expect(
                getAccountAssetBalanceHistoryEndpointPath('ADDR1', '123'),
            ).toBe('/v1/accounts/ADDR1/assets/123/balance-history/')
        })
    })

    describe('fetchAccountAssetBalanceHistory', () => {
        it('sends a GET with period and currency and returns data', async () => {
            const payload = { items: [] }
            ;(queryClient as Mock).mockResolvedValue({ data: payload })

            const result = await fetchAccountAssetBalanceHistory(
                'ADDR1',
                '123',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                '1M' as any,
                'USD',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'testnet' as any,
            )

            expect(queryClient).toHaveBeenCalledWith({
                backend: 'pera',
                network: 'testnet',
                method: 'GET',
                url: '/v1/accounts/ADDR1/assets/123/balance-history/',
                params: {
                    period: '1M',
                    currency: 'USD',
                },
                timeout: CHART_QUERY_TIMEOUT_MS,
            })
            expect(result).toBe(payload)
        })
    })
})
