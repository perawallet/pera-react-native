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
import { summarize } from '../stats'

describe('summarize', () => {
    it('takes the middle sample of an odd count as the median', () => {
        expect(summarize([30, 10, 20]).medianMs).toBe(20)
    })

    it('averages the two middle samples of an even count', () => {
        expect(summarize([10, 20, 30, 40]).medianMs).toBe(25)
    })

    it('reports min, max and mean', () => {
        const stats = summarize([10, 20, 30])

        expect(stats.minMs).toBe(10)
        expect(stats.maxMs).toBe(30)
        expect(stats.meanMs).toBe(20)
    })

    it('uses the nearest rank for p95', () => {
        const samples = Array.from({ length: 20 }, (_, i) => i + 1)

        expect(summarize(samples).p95Ms).toBe(19)
    })

    it('returns the one sample for every figure when there is only one', () => {
        expect(summarize([7])).toEqual({
            medianMs: 7,
            p95Ms: 7,
            minMs: 7,
            maxMs: 7,
            meanMs: 7,
        })
    })

    it('throws on no samples', () => {
        expect(() => summarize([])).toThrow()
    })
})
