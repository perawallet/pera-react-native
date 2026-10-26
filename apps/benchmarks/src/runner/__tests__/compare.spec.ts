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
import { compareRuns, isComparable } from '../compare'
import type { ResultsFile, RunMeta, ScenarioRun } from '../types'

const META: RunMeta = {
    platform: 'android',
    deviceModel: 'Pixel 7',
    osVersion: '15',
    isDevBuild: false,
    scalesHash: 'abc',
    chains: ['algorand'],
    startedAt: '2026-10-26T10:00:00.000Z',
}

const run = (key: string, medianMs: number, peakGrowthMb = 0): ScenarioRun => ({
    key,
    scenarioId: key.split('@')[0],
    scale: 'S',
    iterations: 10,
    timing: {
        medianMs,
        p95Ms: medianMs,
        minMs: medianMs,
        maxMs: medianMs,
        meanMs: medianMs,
    },
    heap: {
        beforeMb: 100,
        afterMb: 100,
        peakMb: 100 + peakGrowthMb,
    },
})

const file = (
    runs: ScenarioRun[],
    meta: Partial<RunMeta> = {},
): ResultsFile => ({
    version: 1,
    meta: { ...META, ...meta },
    runs,
})

const verdictOf = (baseline: ScenarioRun[], current: ScenarioRun[]) =>
    compareRuns(file(baseline), file(current))[0]

describe('compareRuns', () => {
    it('flags a median that grew past the tolerance and the floor', () => {
        const row = verdictOf([run('db.a@S', 100)], [run('db.a@S', 125)])

        expect(row.verdict).toBe('worse')
        expect(row.deltaPct).toBeCloseTo(25)
    })

    it('ignores a relative jump smaller than the floor', () => {
        expect(verdictOf([run('db.a@S', 4)], [run('db.a@S', 5)]).verdict).toBe(
            'same',
        )
    })

    it('credits a median that shrank past the tolerance and the floor', () => {
        expect(
            verdictOf([run('db.a@S', 100)], [run('db.a@S', 75)]).verdict,
        ).toBe('better')
    })

    it('treats a change inside the tolerance as the same', () => {
        expect(
            verdictOf([run('db.a@S', 100)], [run('db.a@S', 110)]).verdict,
        ).toBe('same')
    })

    it('marks a scenario only the current run has as new, and the reverse as missing', () => {
        const rows = compareRuns(
            file([run('db.old@S', 10)]),
            file([run('db.new@S', 10)]),
        )

        expect(rows.find(r => r.key === 'db.new@S')?.verdict).toBe('new')
        expect(rows.find(r => r.key === 'db.old@S')?.verdict).toBe('missing')
    })

    it('judges heap by growth over the run, against its own floor', () => {
        expect(
            verdictOf([run('db.a@S', 100, 2)], [run('db.a@S', 100, 4)])
                .heapVerdict,
        ).toBe('same')
        expect(
            verdictOf([run('db.a@S', 100, 10)], [run('db.a@S', 100, 40)])
                .heapVerdict,
        ).toBe('worse')
    })

    const failed = (key: string): ScenarioRun => ({
        ...run(key, 0),
        timing: null,
        heap: null,
        error: 'boom',
    })

    it('reports a run that passed before and throws now as an error', () => {
        const row = verdictOf([run('db.a@S', 100)], [failed('db.a@S')])

        expect(row.verdict).toBe('error')
        expect(row.heapVerdict).toBe('error')
        expect(row.deltaPct).toBeNull()
    })

    it('reports a run that threw before and passes now as fixed', () => {
        expect(
            verdictOf([failed('db.a@S')], [run('db.a@S', 100)]).verdict,
        ).toBe('fixed')
    })

    it('keeps reporting an error when both runs threw', () => {
        expect(verdictOf([failed('db.a@S')], [failed('db.a@S')]).verdict).toBe(
            'error',
        )
    })

    it('judges the memory group on what the run left behind, not its peak', () => {
        const memory = (retained: number, peak: number): ScenarioRun => ({
            ...run('memory.soak@S', 100),
            heap: {
                beforeMb: 100,
                afterMb: 100 + retained,
                peakMb: 100 + peak,
            },
        })

        // The peak is the same; the heap kept 30 MB more than before.
        expect(verdictOf([memory(2, 50)], [memory(32, 50)]).heapVerdict).toBe(
            'worse',
        )
        // Other groups ignore retained growth.
        const other = (retained: number): ScenarioRun => ({
            ...run('db.a@S', 100),
            heap: { beforeMb: 100, afterMb: 100 + retained, peakMb: 110 },
        })
        expect(verdictOf([other(2)], [other(32)]).heapVerdict).toBe('same')
    })

    it('does not call a run with no heap reading a pass', () => {
        const noHeap: ScenarioRun = { ...run('db.a@S', 100), heap: null }

        const row = verdictOf([run('db.a@S', 100)], [noHeap])

        expect(row.heapVerdict).toBe('missing')
        expect(row.verdict).toBe('same')
    })

    it('does not scale a shrunken-heap baseline into a ratio', () => {
        const memory = (retained: number): ScenarioRun => ({
            ...run('memory.soak@S', 100),
            heap: { beforeMb: 100, afterMb: 100 + retained, peakMb: 100 },
        })

        expect(verdictOf([memory(-20)], [memory(-5)]).heapVerdict).toBe('worse')
    })
})

describe('isComparable', () => {
    it('accepts runs on the same device, build and scale table', () => {
        expect(isComparable(META, { ...META, startedAt: 'later' })).toBe(true)
    })

    it.each([
        ['deviceModel', 'Pixel 8'],
        ['platform', 'ios'],
        ['osVersion', '14'],
        ['isDevBuild', true],
        ['scalesHash', 'other'],
        ['chains', ['algorand', 'ethereum']],
    ] as const)('refuses runs that differ in %s', (field, value) => {
        expect(isComparable(META, { ...META, [field]: value })).toBe(false)
    })
})
