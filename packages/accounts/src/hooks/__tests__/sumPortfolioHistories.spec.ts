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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PortfolioHistoryPoint } from '../../chain-adapter'
import { sumPortfolioHistories } from '../sumPortfolioHistories'

const point = (
    timestamp: number,
    usd: number,
    native = usd,
): PortfolioHistoryPoint => ({
    timestamp,
    usdValue: new Decimal(usd),
    nativeValue: new Decimal(native),
})

const identity = (usdValue: Decimal) => usdValue

const summary = (
    items: ReturnType<typeof sumPortfolioHistories>,
): [number, string | undefined][] =>
    items.map(item => [
        item.datetime.getTime(),
        item.preferredValue?.toString(),
    ])

describe('sumPortfolioHistories', () => {
    it('returns a lone series point for point, keeping its native value', () => {
        const result = sumPortfolioHistories(
            [[point(1, 5, 50), point(2, 6, 60)]],
            usd => usd.times(2),
        )

        expect(result).toEqual([
            {
                datetime: new Date(1),
                preferredValue: new Decimal(10),
                nativeValue: new Decimal(50),
            },
            {
                datetime: new Date(2),
                preferredValue: new Decimal(12),
                nativeValue: new Decimal(60),
            },
        ])
    })

    it('starts at the latest first point, then takes every timestamp, each chain at its latest value at or before it', () => {
        const a = [point(0, 2), point(3, 3)]
        const b = [point(1, 10), point(4, 20)]

        const result = sumPortfolioHistories([a, b], identity)

        expect(summary(result)).toEqual([
            [1, '12'],
            [3, '13'],
            [4, '23'],
        ])
        expect(result.every(item => item.nativeValue === null)).toBe(true)
    })

    it('carries a chain across a point it lacks instead of dropping to zero', () => {
        const a = [point(1, 100), point(2, 100), point(3, 100)]
        const b = [point(1, 5), point(3, 7)]

        const result = sumPortfolioHistories([a, b], identity)

        expect(summary(result)).toEqual([
            [1, '105'],
            [2, '105'],
            [3, '107'],
        ])
    })

    it('sorts a series that arrives out of order', () => {
        const result = sumPortfolioHistories(
            [[point(2, 4), point(1, 3)], [point(1, 1)]],
            identity,
        )

        expect(summary(result)).toEqual([
            [1, '4'],
            [2, '5'],
        ])
    })

    it('is empty when any chain has no history', () => {
        expect(sumPortfolioHistories([[point(1, 5)], []], identity)).toEqual([])
    })

    it('is empty with no series', () => {
        expect(sumPortfolioHistories([], identity)).toEqual([])
    })

    it('leaves the preferred value null where the rate is unresolved', () => {
        const result = sumPortfolioHistories(
            [[point(1, 5)], [point(1, 6)]],
            () => null,
        )

        expect(result[0]?.preferredValue).toBeNull()
    })
})
