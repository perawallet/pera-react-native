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
import type { PortfolioHistoryPoint } from './chain-adapter'

/**
 * The fiat sum of several chains' histories, each oldest first. Chains sample
 * on their own grids, so each contributes its latest point at or before every
 * timestamp. The sum starts once every chain has a point, since an earlier one
 * would leave a chain out and draw a cliff. A chain with no points is skipped:
 * that's an address with no activity, which holds nothing to add, and a failed
 * fetch is reported as an error rather than reaching here. Native values are
 * dropped: they're in each chain's own unit and don't sum.
 */
export const sumPortfolioHistories = (
    allSeries: PortfolioHistoryPoint[][],
): Array<Pick<PortfolioHistoryPoint, 'timestamp' | 'usdValue'>> => {
    const series = allSeries.filter(points => points.length > 0)
    if (series.length === 0) {
        return []
    }

    const start = Math.max(...series.map(points => points[0].timestamp))
    const timestamps = [
        ...new Set(
            series.flatMap(points => points.map(({ timestamp }) => timestamp)),
        ),
    ]
        .filter(timestamp => timestamp >= start)
        .sort((a, b) => a - b)

    const cursors = series.map(() => 0)
    return timestamps.map(timestamp => ({
        timestamp,
        usdValue: series.reduce((total, points, index) => {
            while (
                cursors[index] + 1 < points.length &&
                points[cursors[index] + 1].timestamp <= timestamp
            ) {
                cursors[index] += 1
            }
            return total.plus(points[cursors[index]].usdValue)
        }, new Decimal(0)),
    }))
}
