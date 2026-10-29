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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PortfolioHistoryPoint } from '../chain-adapter'
import { sumPortfolioHistories } from '../portfolio-history'

const point = (timestamp: number, usd: string): PortfolioHistoryPoint => ({
    timestamp,
    usdValue: new Decimal(usd),
    nativeValue: new Decimal(1),
})

const values = (series: ReturnType<typeof sumPortfolioHistories>) =>
    series.map(({ timestamp, usdValue }) => [timestamp, usdValue.toString()])

describe('sumPortfolioHistories', () => {
    it('passes a single series through, dropping its native values', () => {
        const result = sumPortfolioHistories([[point(1, '10'), point(2, '20')]])

        expect(result).toEqual([
            { timestamp: 1, usdValue: new Decimal(10) },
            { timestamp: 2, usdValue: new Decimal(20) },
        ])
    })

    it('sums aligned series per timestamp', () => {
        const result = sumPortfolioHistories([
            [point(1, '10'), point(2, '20')],
            [point(1, '1'), point(2, '2')],
        ])

        expect(values(result)).toEqual([
            [1, '11'],
            [2, '22'],
        ])
    })

    it('carries the latest earlier point forward across offset grids', () => {
        const result = sumPortfolioHistories([
            [point(10, '100'), point(20, '200')],
            [point(10, '1'), point(15, '5')],
        ])

        expect(values(result)).toEqual([
            [10, '101'],
            [15, '105'],
            [20, '205'],
        ])
    })

    it('starts once every series has a point', () => {
        const result = sumPortfolioHistories([
            [point(1, '10'), point(2, '20'), point(3, '30')],
            [point(2, '2'), point(3, '3')],
        ])

        expect(values(result)).toEqual([
            [2, '22'],
            [3, '33'],
        ])
    })

    it('skips a chain with no points, as for an Algorand address with no activity beside a funded Ethereum one', () => {
        const result = sumPortfolioHistories([
            [],
            [point(1, '10'), point(2, '20')],
        ])

        expect(values(result)).toEqual([
            [1, '10'],
            [2, '20'],
        ])
    })

    it('is empty when no series has history', () => {
        expect(sumPortfolioHistories([[], []])).toEqual([])
        expect(sumPortfolioHistories([])).toEqual([])
    })

    it('keeps precision beyond 2^53', () => {
        const result = sumPortfolioHistories([
            [point(1, '9007199254740993.01')],
            [point(1, '0.02')],
        ])

        expect(values(result)).toEqual([[1, '9007199254740993.03']])
    })
})
