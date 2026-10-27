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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { describe, expect, it } from 'vitest'
import { countCreatedAssets, countSeederPayments } from '../chain-state'

type Page<T> = { items: T[]; nextToken?: string }

// An indexer query that serves each page under the token the previous one returned.
const paged = <T>(
    key: 'assets' | 'transactions',
    pages: Record<string, Page<T>>,
) => {
    const query = {
        token: '',
        limit: () => query,
        nextToken: (token: string) => {
            query.token = token
            return query
        },
        address: () => query,
        addressRole: () => query,
        txType: () => query,
        notePrefix: () => query,
        do: async () => {
            const page = pages[query.token] ?? { items: [] }
            query.token = ''
            return { [key]: page.items, nextToken: page.nextToken }
        },
    }
    return query
}

const algorandWith = (indexer: object) =>
    ({ client: { indexer } }) as unknown as AlgorandClient

const asset = (unitName: string, deleted = false) => ({
    deleted,
    params: { unitName },
})

describe('countCreatedAssets', () => {
    it("counts the seeder's fungible assets and NFTs and ignores everything else", async () => {
        const items = [
            asset('PSA1'),
            asset('PSA2'),
            asset('PSN1'),
            asset('USDC'),
            asset('PSA3', true),
        ]
        const indexer = {
            lookupAccountCreatedAssets: () =>
                paged('assets', { '': { items } }),
        }

        expect(await countCreatedAssets(algorandWith(indexer), 'ADDR')).toEqual(
            {
                assets: 2,
                nfts: 1,
            },
        )
    })

    it('keeps following the next token when the indexer returns fewer rows than asked for', async () => {
        // Each page is far below the requested page size, as a capped public endpoint answers.
        const pages = {
            '': { items: [asset('PSA1'), asset('PSA2')], nextToken: 't1' },
            t1: { items: [asset('PSA3'), asset('PSN1')], nextToken: 't2' },
            t2: { items: [asset('PSN2')] },
        }
        const indexer = {
            lookupAccountCreatedAssets: () => paged('assets', pages),
        }

        expect(await countCreatedAssets(algorandWith(indexer), 'ADDR')).toEqual(
            {
                assets: 3,
                nfts: 2,
            },
        )
    })

    it('stops on an empty page even if a token comes back, rather than looping', async () => {
        const pages = {
            '': { items: [asset('PSA1')], nextToken: 't1' },
            t1: { items: [], nextToken: 't1' },
        }
        const indexer = {
            lookupAccountCreatedAssets: () => paged('assets', pages),
        }

        expect(await countCreatedAssets(algorandWith(indexer), 'ADDR')).toEqual(
            {
                assets: 1,
                nfts: 0,
            },
        )
    })
})

describe('countSeederPayments', () => {
    it('sums every page, however small the indexer makes them', async () => {
        const pages = {
            '': { items: [{}, {}, {}], nextToken: 't1' },
            t1: { items: [{}, {}], nextToken: 't2' },
            t2: { items: [{}] },
        }
        const indexer = {
            searchForTransactions: () => paged('transactions', pages),
        }

        expect(await countSeederPayments(algorandWith(indexer), 'ADDR')).toBe(6)
    })

    it('stops on an empty page even if a token comes back', async () => {
        const pages = {
            '': { items: [{}], nextToken: 't1' },
            t1: { items: [], nextToken: 't1' },
        }
        const indexer = {
            searchForTransactions: () => paged('transactions', pages),
        }

        expect(await countSeederPayments(algorandWith(indexer), 'ADDR')).toBe(1)
    })
})
