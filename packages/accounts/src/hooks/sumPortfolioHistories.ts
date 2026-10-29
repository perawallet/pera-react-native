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

import { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PortfolioHistoryPoint } from '../chain-adapter'
import type { AccountBalanceHistoryItem } from '../models'

/**
 * Adds one history series per chain into one. The sum starts at the latest of
 * the series' first points, so a chain with no value yet never reads as 0 or
 * leaves a cliff, then has a point at every timestamp any chain has, each
 * chain at its latest value at or before it. Any empty series makes it empty,
 * since the chart would otherwise plot a total that leaves a chain out.
 * `nativeValue` is `null` across chains: their native assets don't add.
 */
export const sumPortfolioHistories = (
    series: PortfolioHistoryPoint[][],
    usdToPreferred: (usdValue: Decimal) => Nullable<Decimal>,
): AccountBalanceHistoryItem[] => {
    if (series.length === 0 || series.some(points => points.length === 0)) {
        return []
    }
    const sorted = series.map(points =>
        [...points].sort((a, b) => a.timestamp - b.timestamp),
    )

    if (sorted.length === 1) {
        return sorted[0]!.map(point => ({
            datetime: new Date(point.timestamp),
            preferredValue: usdToPreferred(point.usdValue),
            nativeValue: point.nativeValue,
        }))
    }

    const start = Math.max(...sorted.map(points => points[0]!.timestamp))
    const timestamps = [
        ...new Set(
            sorted.flatMap(points => points.map(({ timestamp }) => timestamp)),
        ),
    ]
        .filter(timestamp => timestamp >= start)
        .sort((a, b) => a - b)

    // Every cursor starts on a point at or before `start`, so each chain
    // always has a value to carry.
    const cursors = sorted.map(() => 0)
    return timestamps.map(timestamp => {
        let usdValue = new Decimal(0)
        sorted.forEach((points, index) => {
            while (
                cursors[index]! + 1 < points.length &&
                points[cursors[index]! + 1]!.timestamp <= timestamp
            ) {
                cursors[index]!++
            }
            usdValue = usdValue.plus(points[cursors[index]!]!.usdValue)
        })
        return {
            datetime: new Date(timestamp),
            preferredValue: usdToPreferred(usdValue),
            nativeValue: null,
        }
    })
}
