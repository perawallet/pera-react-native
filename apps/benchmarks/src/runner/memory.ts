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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { HeapSample } from './types'

const BYTES_PER_MB = 1024 * 1024

type HermesStats = {
    js_totalAllocatedBytes?: number
    js_numGCs?: number
}

type HermesGlobal = {
    HermesInternal?: { getInstrumentedStats?: () => HermesStats }
}

/**
 * Hermes' heap through the web `performance.memory` that React Native
 * exposes, or `null` when the runtime has none: a missing reading must not
 * pass for a heap that stayed flat. Allocations and GC count come from
 * Hermes' instrumented stats and are left out where the engine does not
 * report them.
 */
export const readHeap = (): Nullable<HeapSample> => {
    const memory = (
        globalThis.performance as { memory?: Record<string, Nullable<number>> }
    ).memory
    if (typeof memory?.usedJSHeapSize !== 'number') return null
    const stats = (
        globalThis as unknown as HermesGlobal
    ).HermesInternal?.getInstrumentedStats?.()

    return {
        usedMb: memory.usedJSHeapSize / BYTES_PER_MB,
        totalMb: (memory.totalJSHeapSize ?? 0) / BYTES_PER_MB,
        ...(stats?.js_totalAllocatedBytes !== undefined && {
            allocatedMb: stats.js_totalAllocatedBytes / BYTES_PER_MB,
        }),
        ...(stats?.js_numGCs !== undefined && { gcCount: stats.js_numGCs }),
    }
}

/**
 * Collects garbage where the engine exposes `gc`, so the heap read right after
 * is what the code holds rather than what it has not yet released. Without it
 * the readings still work, and small differences are noise.
 */
export const collectGarbage = (): void => {
    ;(globalThis as { gc?: () => void }).gc?.()
}
