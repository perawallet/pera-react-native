/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { uniformIntBelow, pickDistinctIndexes } from '../random'

afterEach(() => {
    vi.restoreAllMocks()
})

/** Helper: stub `crypto.getRandomValues` to yield a fixed sequence of u32s. */
const stubRandomValues = (values: number[]) => {
    let i = 0
    return vi
        .spyOn(crypto, 'getRandomValues')
        .mockImplementation(<T extends ArrayBufferView | null>(buf: T): T => {
            if (!buf) return buf
            const arr = buf as unknown as Uint32Array
            arr[0] = values[i++ % values.length]
            return buf
        })
}

describe('uniformIntBelow', () => {
    it('returns 0 when max <= 0', () => {
        expect(uniformIntBelow(0)).toBe(0)
        expect(uniformIntBelow(-1)).toBe(0)
    })

    it('returns 0 when max is 1', () => {
        // Every drawn value is < limit (0x100000000) and `value % 1 === 0`.
        stubRandomValues([42])
        expect(uniformIntBelow(1)).toBe(0)
    })

    it('returns value % max for a value below the rejection limit', () => {
        // max = 10 → limit = floor(2^32 / 10) * 10 = 4_294_967_290.
        // value = 7 is below limit → returned as 7 % 10 = 7.
        stubRandomValues([7])
        expect(uniformIntBelow(10)).toBe(7)
    })

    it('rejects and resamples when value >= limit (debiased rejection sampling)', () => {
        // max = 10 → limit = 4_294_967_290.
        // First sample 4_294_967_295 is above the limit and must be rejected.
        // Second sample 3 is accepted → returned as 3.
        const spy = stubRandomValues([0xffffffff, 3])
        expect(uniformIntBelow(10)).toBe(3)
        expect(spy).toHaveBeenCalledTimes(2)
    })

    it('produces values uniformly distributed across [0, max)', () => {
        // Smoke-check distribution: with the real CSRNG, draws across a small
        // range should hit every bucket over a modest sample size.
        const buckets = new Array(5).fill(0)
        for (let i = 0; i < 500; i++) {
            buckets[uniformIntBelow(5)]++
        }
        for (const count of buckets) {
            expect(count).toBeGreaterThan(0)
        }
    })
})

describe('pickDistinctIndexes', () => {
    it('returns the full pool when count >= poolSize', () => {
        const result = pickDistinctIndexes(10, 5)
        expect(result).toHaveLength(5)
        expect([...result].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    })

    it('returns count distinct indexes from [0, poolSize)', () => {
        const result = pickDistinctIndexes(3, 10)
        expect(result).toHaveLength(3)
        expect(new Set(result).size).toBe(3)
        for (const idx of result) {
            expect(idx).toBeGreaterThanOrEqual(0)
            expect(idx).toBeLessThan(10)
        }
    })

    it('returns an empty array when count is 0', () => {
        expect(pickDistinctIndexes(0, 10)).toEqual([])
    })

    it('returns an empty array when count is negative', () => {
        expect(pickDistinctIndexes(-3, 10)).toEqual([])
    })

    it('returns an empty array when the pool is empty', () => {
        expect(pickDistinctIndexes(5, 0)).toEqual([])
    })

    it('shuffles using uniformIntBelow — sample is not necessarily sorted', () => {
        // Across many runs, at least one should come back out of natural order;
        // otherwise the shuffle has degenerated.
        let sawUnsorted = false
        for (let i = 0; i < 50; i++) {
            const result = pickDistinctIndexes(10, 10)
            const sorted = [...result].sort((a, b) => a - b)
            if (result.some((v, idx) => v !== sorted[idx])) {
                sawUnsorted = true
                break
            }
        }
        expect(sawUnsorted).toBe(true)
    })
})
