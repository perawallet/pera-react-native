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
import { heapGrowthPerMinute } from '../heapSeries'
import { runSoak } from '../soak'

describe('runSoak', () => {
    const makeClock = () => {
        let now = 0
        return {
            now: () => now,
            advance: (ms: number) => {
                now += ms
            },
        }
    }

    it('ticks until the duration has passed and returns the tick count', async () => {
        const clock = makeClock()

        const ticks = await runSoak({
            durationMs: 1000,
            sampleEvery: 100,
            tick: async () => clock.advance(250),
            sample: () => {},
            now: clock.now,
        })

        expect(ticks).toBe(4)
    })

    it('samples at the start, every N ticks and at the end', async () => {
        const clock = makeClock()
        const samples: number[] = []

        await runSoak({
            durationMs: 1000,
            sampleEvery: 2,
            tick: async () => clock.advance(100),
            sample: atMs => samples.push(atMs),
            now: clock.now,
        })

        expect(samples).toEqual([0, 200, 400, 600, 800, 1000, 1000])
    })

    it('lets a failing tick end the run with its error', async () => {
        const clock = makeClock()

        await expect(
            runSoak({
                durationMs: 1000,
                sampleEvery: 1,
                tick: async () => {
                    throw new Error('sync did not run')
                },
                sample: () => {},
                now: clock.now,
            }),
        ).rejects.toThrow('sync did not run')
    })
})

describe('heapGrowthPerMinute', () => {
    it('reads a steady climb as MB per minute', () => {
        expect(
            heapGrowthPerMinute([
                { atMs: 0, usedMb: 100 },
                { atMs: 60_000, usedMb: 102 },
                { atMs: 120_000, usedMb: 104 },
            ]),
        ).toBeCloseTo(2)
    })

    it('reads a flat heap as zero', () => {
        expect(
            heapGrowthPerMinute([
                { atMs: 0, usedMb: 100 },
                { atMs: 60_000, usedMb: 100 },
            ]),
        ).toBeCloseTo(0)
    })

    it('has no slope with fewer than two readings or no elapsed time', () => {
        expect(heapGrowthPerMinute([{ atMs: 0, usedMb: 1 }])).toBeNull()
        expect(
            heapGrowthPerMinute([
                { atMs: 5, usedMb: 1 },
                { atMs: 5, usedMb: 2 },
            ]),
        ).toBeNull()
    })
})
