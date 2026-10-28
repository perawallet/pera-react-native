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
import { BENCH_SCALES, scalesHash } from '../scales'
import type { BenchScale } from '../types'

const ORDER = ['S', 'M', 'L', 'XL'] as const

describe('BENCH_SCALES', () => {
    it.each([
        'accounts',
        'heavyAccountAssets',
        'assetsPerAccount',
        'heavyAccountTransactions',
        'chains',
    ] as const)('never shrinks %s from one scale to the next', dimension => {
        const values = ORDER.map(name => BENCH_SCALES[name][dimension])

        expect(values).toEqual([...values].sort((a, b) => a - b))
    })

    it('names each scale after its key', () => {
        for (const name of ORDER) {
            expect(BENCH_SCALES[name].name).toBe(name)
        }
    })
})

describe('scalesHash', () => {
    it('is stable across calls', () => {
        expect(scalesHash(BENCH_SCALES)).toBe(scalesHash(BENCH_SCALES))
    })

    it('changes when any one value changes', () => {
        const changed: Record<BenchScale['name'], BenchScale> = {
            ...BENCH_SCALES,
            M: { ...BENCH_SCALES.M, accounts: BENCH_SCALES.M.accounts + 1 },
        }

        expect(scalesHash(changed)).not.toBe(scalesHash(BENCH_SCALES))
    })
})
