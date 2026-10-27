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

import type { TimingStats } from './types'

export const summarize = (samplesMs: readonly number[]): TimingStats => {
    if (samplesMs.length === 0) {
        throw new Error('summarize needs at least one sample')
    }
    const sorted = [...samplesMs].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    const medianMs =
        sorted.length % 2 === 1
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2
    const p95Rank = Math.ceil(0.95 * sorted.length)

    return {
        medianMs,
        p95Ms: sorted[p95Rank - 1],
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1],
        meanMs: sorted.reduce((sum, sample) => sum + sample, 0) / sorted.length,
    }
}
