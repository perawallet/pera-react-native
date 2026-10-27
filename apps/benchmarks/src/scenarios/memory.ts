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

import { collectGarbage, readHeap } from '../runner/memory'
import { runSoak } from '../runner/soak'
import type { HeapPoint, Scenario } from '../runner/types'
import {
    afterFirstTick,
    changedTick,
    changeHoldings,
    provenTick,
    type TickState,
} from './sync'

const SOAK_PASSES = 30

/**
 * Repeated sync passes with nothing else running. The heap figure to read is
 * how far `afterMb` ends above `beforeMb`: what thirty passes leave behind.
 */
const syncSoak: Scenario<TickState> = {
    ...changedTick,
    id: 'memory.sync-soak',
    group: 'memory',
    title: `${SOAK_PASSES} sync passes in a row`,
    scales: ['S', 'M'],
    iterations: SOAK_PASSES,
    warmup: 0,
}

const LONG_SOAK_MINUTES = 10
/** Ticks between heap readings. */
const LONG_SOAK_SAMPLE_EVERY = 10

type LongSoakState = TickState & { points: HeapPoint[] }

/**
 * Sync passes back to back for a fixed wall-clock time, with the heap read
 * along the way so a slow leak shows as a trend. The one timed sample is the
 * whole run; the figures to read are the heap series and its slope.
 */
const longSoak: Scenario<LongSoakState> = {
    id: 'memory.long-soak',
    group: 'memory',
    title: `${LONG_SOAK_MINUTES} minutes of sync passes, heap read every ${LONG_SOAK_SAMPLE_EVERY} passes`,
    scales: ['S', 'M', 'L'],
    isLong: true,
    iterations: 1,
    warmup: 0,
    setup: async (ctx, scale) => ({
        ...(await afterFirstTick(true, s => s.accounts)(ctx, scale)),
        points: [],
    }),
    run: async state => {
        state.points = []
        await runSoak({
            durationMs: LONG_SOAK_MINUTES * 60_000,
            sampleEvery: LONG_SOAK_SAMPLE_EVERY,
            now: () => performance.now(),
            tick: async () => {
                await changeHoldings(state)
                await provenTick(state.ctx, state.service, state.minRequests)
            },
            sample: atMs => {
                collectGarbage()
                const heap = readHeap()
                if (heap) state.points.push({ atMs, usedMb: heap.usedMb })
            },
        })
    },
    heapSeries: state => state.points,
}

export const memoryScenarios: Scenario[] = [
    syncSoak as Scenario,
    longSoak as Scenario,
]
