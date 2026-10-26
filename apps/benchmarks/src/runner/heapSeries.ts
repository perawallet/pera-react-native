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

import type { HeapPoint } from './types'

const MS_PER_MINUTE = 60_000

/**
 * The heap's slope over a series, in MB per minute (least squares), so a slow
 * leak shows as a trend rather than as two readings. Null with fewer than two
 * points or no elapsed time.
 */
export const heapGrowthPerMinute = (
    series: readonly HeapPoint[],
): number | null => {
    if (series.length < 2) return null
    const n = series.length
    const meanX = series.reduce((sum, p) => sum + p.atMs, 0) / n
    const meanY = series.reduce((sum, p) => sum + p.usedMb, 0) / n
    let covariance = 0
    let variance = 0
    for (const p of series) {
        covariance += (p.atMs - meanX) * (p.usedMb - meanY)
        variance += (p.atMs - meanX) ** 2
    }
    return variance === 0 ? null : (covariance / variance) * MS_PER_MINUTE
}
