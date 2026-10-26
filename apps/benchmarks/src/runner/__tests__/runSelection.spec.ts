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
import { runSelection } from '../runSelection'
import type { BenchScale, Scenario, ScenarioContext } from '../types'

const SCALE: BenchScale = {
    name: 'S',
    accounts: 1,
    heavyAccountAssets: 1,
    assetsPerAccount: 1,
    heavyAccountTransactions: 1,
    chains: 1,
}

const ctx = { resetState: async () => {} } as unknown as ScenarioContext

const scenario = (id: string, fail = false): Scenario<void> => ({
    id,
    group: 'db',
    title: id,
    scales: ['S'],
    iterations: 1,
    warmup: 0,
    setup: async () => {
        if (fail) throw new Error('no fixture')
    },
    run: async () => {},
})

describe('runSelection', () => {
    it('keeps going after one entry fails', async () => {
        const results = await runSelection(
            [
                { scenario: scenario('db.a', true), scale: SCALE },
                { scenario: scenario('db.b'), scale: SCALE },
            ],
            ctx,
            () => {},
        )

        expect(results.map(r => r.key)).toEqual(['db.a@S', 'db.b@S'])
        expect(results[0].error).toBe('no fixture')
        expect(results[1].error).toBeUndefined()
    })

    it('reports progress for every entry in order', async () => {
        const onProgress = vi.fn()

        await runSelection(
            [
                { scenario: scenario('db.a'), scale: SCALE },
                { scenario: scenario('db.b'), scale: SCALE },
            ],
            ctx,
            onProgress,
        )

        expect(onProgress.mock.calls).toEqual([
            [0, 2, 'db.a@S'],
            [1, 2, 'db.b@S'],
            [2, 2, ''],
        ])
    })
})
