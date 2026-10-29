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

import { toError, type Nullable } from '@perawallet/wallet-core-shared'
import { collectGarbage, readHeap } from './memory'
import { summarize } from './stats'
import type {
    BenchScale,
    HeapStats,
    Scenario,
    ScenarioContext,
    ScenarioRun,
} from './types'

const DEFAULT_ITERATIONS = 10
const DEFAULT_WARMUP = 2

const messageOf = (error: unknown): string => toError(error).message

export const runScenario = async (
    scenario: Scenario,
    scale: BenchScale,
    ctx: ScenarioContext,
    clock: () => number = () => performance.now(),
): Promise<ScenarioRun> => {
    const iterations = scenario.iterations ?? DEFAULT_ITERATIONS
    const warmup = scenario.warmup ?? DEFAULT_WARMUP
    const base = {
        key: `${scenario.id}@${scale.name}`,
        scenarioId: scenario.id,
        scale: scale.name,
        iterations,
    }
    const failed = (error: unknown): ScenarioRun => ({
        ...base,
        timing: null,
        heap: null,
        error: messageOf(error),
    })

    let state: unknown
    try {
        await ctx.resetState()
        state = await scenario.setup(ctx, scale)
    } catch (error) {
        return failed(error)
    }

    let result: ScenarioRun
    try {
        for (let i = 0; i < warmup; i++) {
            await scenario.beforeEach?.(state)
            await scenario.run(state)
            await scenario.afterEach?.(state)
        }

        collectGarbage()
        const before = readHeap()
        let peakMb = before?.usedMb ?? 0
        const samples: number[] = []
        for (let i = 0; i < iterations; i++) {
            await scenario.beforeEach?.(state)
            const start = clock()
            await scenario.run(state)
            samples.push(clock() - start)
            peakMb = Math.max(peakMb, readHeap()?.usedMb ?? 0)
            await scenario.afterEach?.(state)
        }
        collectGarbage()
        const after = readHeap()

        const heap: Nullable<HeapStats> =
            before && after
                ? {
                      beforeMb: before.usedMb,
                      afterMb: after.usedMb,
                      peakMb: Math.max(peakMb, after.usedMb),
                      ...(before.allocatedMb !== undefined &&
                          after.allocatedMb !== undefined && {
                              allocatedMb:
                                  after.allocatedMb - before.allocatedMb,
                          }),
                      ...(before.gcCount !== undefined &&
                          after.gcCount !== undefined && {
                              gcCount: after.gcCount - before.gcCount,
                          }),
                  }
                : null
        const series = scenario.heapSeries?.(state)
        result = {
            ...base,
            timing: summarize(samples),
            heap,
            ...(series && series.length > 0 && { heapSeries: [...series] }),
        }
    } catch (error) {
        result = failed(error)
    }

    try {
        await scenario.teardown?.(state)
    } catch (error) {
        if (!result.error) result = failed(error)
    }
    return result
}
