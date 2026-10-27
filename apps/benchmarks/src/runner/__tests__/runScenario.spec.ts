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

import { describe, expect, it, vi } from 'vitest'
import { collectGarbage, readHeap } from '../memory'
import { runScenario } from '../runScenario'
import type { BenchScale, Scenario, ScenarioContext } from '../types'

const SCALE: BenchScale = {
    name: 'S',
    accounts: 1,
    heavyAccountAssets: 1,
    assetsPerAccount: 1,
    heavyAccountTransactions: 1,
    chains: 1,
}

const makeCtx = (calls: string[] = []): ScenarioContext =>
    ({
        resetState: vi.fn(async () => {
            calls.push('reset')
        }),
    }) as unknown as ScenarioContext

// Each reading moves the clock on by the next step.
const steppedClock = (steps: number[]) => {
    let now = 0
    let i = 0
    return () => {
        const value = now
        now += steps[i++ % steps.length]
        return value
    }
}

const scenario = (
    overrides: Partial<Scenario<number>> = {},
): Scenario<number> => ({
    id: 'db.fake',
    group: 'db',
    title: 'Fake',
    scales: ['S'],
    iterations: 3,
    warmup: 2,
    setup: async () => 1,
    run: async () => {},
    ...overrides,
})

vi.mock('../memory', () => ({
    readHeap: vi.fn(),
    collectGarbage: vi.fn(),
}))

describe('runScenario', () => {
    it('samples exactly the timed iterations, not the warm-up', async () => {
        const run = vi.fn(async () => {})

        const result = await runScenario(
            scenario({ run }),
            SCALE,
            makeCtx(),
            steppedClock([10]),
        )

        expect(run).toHaveBeenCalledTimes(5)
        expect(result.iterations).toBe(3)
        expect(result.timing?.medianMs).toBe(10)
        expect(result.key).toBe('db.fake@S')
    })

    it('resets state before setup, and tears down after the run', async () => {
        const calls: string[] = []

        await runScenario(
            scenario({
                setup: async () => {
                    calls.push('setup')
                    return 1
                },
                run: async () => {
                    calls.push('run')
                },
                teardown: async () => {
                    calls.push('teardown')
                },
                iterations: 1,
                warmup: 0,
            }),
            SCALE,
            makeCtx(calls),
            steppedClock([1]),
        )

        expect(calls).toEqual(['reset', 'setup', 'run', 'teardown'])
    })

    it('records the error and still tears down when a run throws', async () => {
        const teardown = vi.fn(async () => {})

        const result = await runScenario(
            scenario({
                run: async () => {
                    throw new Error('boom')
                },
                teardown,
            }),
            SCALE,
            makeCtx(),
            steppedClock([1]),
        )

        expect(result.error).toBe('boom')
        expect(result.timing).toBeNull()
        expect(result.heap).toBeNull()
        expect(teardown).toHaveBeenCalledOnce()
    })

    it('records the error when setup throws, without running or tearing down', async () => {
        const run = vi.fn(async () => {})
        const teardown = vi.fn(async () => {})

        const result = await runScenario(
            scenario({
                setup: async () => {
                    throw new Error('no fixture')
                },
                run,
                teardown,
            }),
            SCALE,
            makeCtx(),
            steppedClock([1]),
        )

        expect(result.error).toBe('no fixture')
        expect(run).not.toHaveBeenCalled()
        expect(teardown).not.toHaveBeenCalled()
    })

    it('defaults to 10 iterations after 2 warm-up runs', async () => {
        const run = vi.fn(async () => {})

        await runScenario(
            scenario({ run, iterations: undefined, warmup: undefined }),
            SCALE,
            makeCtx(),
            steppedClock([1]),
        )

        expect(run).toHaveBeenCalledTimes(12)
    })

    describe('heap', () => {
        it('stores no heap when the runtime cannot read one', async () => {
            vi.mocked(readHeap).mockReturnValue(null)

            const result = await runScenario(
                scenario(),
                SCALE,
                makeCtx(),
                steppedClock([1]),
            )

            expect(result.heap).toBeNull()
            expect(result.timing).not.toBeNull()
        })

        it('collects garbage before the readings that bracket the run', async () => {
            const order: string[] = []
            vi.mocked(collectGarbage).mockImplementation(() => {
                order.push('gc')
            })
            vi.mocked(readHeap).mockImplementation(() => {
                order.push('read')
                return { usedMb: 10, totalMb: 20 }
            })

            await runScenario(
                scenario({ iterations: 1, warmup: 0 }),
                SCALE,
                makeCtx(),
                steppedClock([1]),
            )

            expect(order[0]).toBe('gc')
            expect(order[1]).toBe('read')
            expect(order.slice(-2)).toEqual(['gc', 'read'])
        })

        it('reports what the run kept as after over before', async () => {
            const readings = [
                { usedMb: 10, totalMb: 20 },
                { usedMb: 14, totalMb: 20 },
                { usedMb: 12, totalMb: 20 },
            ]
            vi.mocked(readHeap).mockImplementation(
                () => readings.shift() ?? { usedMb: 12, totalMb: 20 },
            )

            const result = await runScenario(
                scenario({ iterations: 1, warmup: 0 }),
                SCALE,
                makeCtx(),
                steppedClock([1]),
            )

            expect(result.heap).toMatchObject({
                beforeMb: 10,
                peakMb: 14,
                afterMb: 12,
            })
        })
    })

    describe('per-iteration hooks', () => {
        it('runs beforeEach before every iteration, warm-up included, and afterEach after it', async () => {
            const calls: string[] = []

            await runScenario(
                scenario({
                    iterations: 2,
                    warmup: 1,
                    beforeEach: async () => {
                        calls.push('before')
                    },
                    run: async () => {
                        calls.push('run')
                    },
                    afterEach: async () => {
                        calls.push('after')
                    },
                }),
                SCALE,
                makeCtx(),
                steppedClock([1]),
            )

            expect(calls).toEqual([
                'before',
                'run',
                'after',
                'before',
                'run',
                'after',
                'before',
                'run',
                'after',
            ])
        })

        it('keeps the hooks outside the timed samples', async () => {
            let now = 0
            const clock = () => now

            const result = await runScenario(
                scenario({
                    iterations: 3,
                    warmup: 0,
                    beforeEach: async () => {
                        now += 1000
                    },
                    run: async () => {
                        now += 10
                    },
                    afterEach: async () => {
                        now += 5000
                    },
                }),
                SCALE,
                makeCtx(),
                clock,
            )

            expect(result.timing?.medianMs).toBe(10)
            expect(result.timing?.maxMs).toBe(10)
        })

        it('records the error and still tears down when afterEach throws', async () => {
            const teardown = vi.fn(async () => {})

            const result = await runScenario(
                scenario({
                    afterEach: async () => {
                        throw new Error('the tick did no work')
                    },
                    teardown,
                }),
                SCALE,
                makeCtx(),
                steppedClock([1]),
            )

            expect(result.error).toBe('the tick did no work')
            expect(teardown).toHaveBeenCalledOnce()
        })

        it('attaches the heap series a long run collected', async () => {
            const result = await runScenario(
                scenario({
                    iterations: 1,
                    warmup: 0,
                    heapSeries: () => [
                        { atMs: 0, usedMb: 10 },
                        { atMs: 60_000, usedMb: 12 },
                    ],
                }),
                SCALE,
                makeCtx(),
                steppedClock([1]),
            )

            expect(result.heapSeries).toEqual([
                { atMs: 0, usedMb: 10 },
                { atMs: 60_000, usedMb: 12 },
            ])
        })
    })
})
