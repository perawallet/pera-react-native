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
import { HOLDINGS_PAGE_LIMIT } from '../constants'
import {
    existsOnChain,
    fetchAccountAssetOptInRounds,
    fetchOnChainAccountInformation,
    type OnChainAccountInformationResponse,
} from '../endpoints'

describe('accounts endpoints', () => {
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

    describe('existsOnChain', () => {
        const account = (
            overrides: Partial<OnChainAccountInformationResponse>,
        ) =>
            ({
                amount: 0n,
                assets: [],
                appsLocalState: [],
                authAddr: undefined,
                ...overrides,
            }) as OnChainAccountInformationResponse

        it('treats an empty account as absent', () => {
            expect(existsOnChain(account({}))).toBe(false)
        })

        it('treats a zero-balance account with held assets as existing', () => {
            expect(
                existsOnChain(
                    account({
                        assets: [
                            { assetId: 1n, amount: 0n, isFrozen: false },
                        ] as OnChainAccountInformationResponse['assets'],
                    }),
                ),
            ).toBe(true)
        })

        it('treats a rekeyed account as existing', () => {
            expect(
                existsOnChain(
                    account({
                        authAddr:
                            'AUTH' as unknown as OnChainAccountInformationResponse['authAddr'],
                    }),
                ),
            ).toBe(true)
        })
    })
})
