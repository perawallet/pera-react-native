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

import type {
    ComparisonRow,
    HeapStats,
    ResultsFile,
    RunMeta,
    ScenarioRun,
    Verdict,
} from './types'

export type CompareOptions = {
    /** Relative growth that counts as a change. */
    tolerance?: number
    floorMs?: number
    heapFloorMb?: number
}

const sameChains = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((chain, i) => chain === b[i])

/** Numbers from different devices, builds or scale tables say nothing about each other. */
export const isComparable = (a: RunMeta, b: RunMeta): boolean =>
    a.platform === b.platform &&
    a.deviceModel === b.deviceModel &&
    a.osVersion === b.osVersion &&
    a.isDevBuild === b.isDevBuild &&
    a.scalesHash === b.scalesHash &&
    sameChains(a.chains, b.chains)

const judge = (
    baseline: number,
    current: number,
    tolerance: number,
    floor: number,
): Verdict => {
    const diff = current - baseline
    if (Math.abs(diff) <= floor) return 'same'
    // A baseline at or below zero (heap that shrank) has no meaningful ratio,
    // so only the floor decides.
    const ratio = baseline <= 0 ? Infinity : Math.abs(diff) / baseline
    if (ratio <= tolerance) return 'same'
    return diff > 0 ? 'worse' : 'better'
}

/** How far the heap climbed during the run, at its highest. */
export const peakGrowthMb = (heap: HeapStats): number =>
    heap.peakMb - heap.beforeMb

/** What the run left behind: the heap after it, over the heap before. */
export const retainedMb = (heap: HeapStats): number =>
    heap.afterMb - heap.beforeMb

/**
 * The memory group exists to show what repeated work leaves behind, so its
 * heap verdict reads retained growth; every other group reads the peak. GC is
 * attempted before the bracketing readings where the runtime exposes `gc`;
 * without it, a small retained figure is noise.
 */
export const usesRetainedGrowth = (scenarioId: string): boolean =>
    scenarioId.startsWith('memory.')

const heapGrowthOf = (run: ScenarioRun, heap: HeapStats): number =>
    usesRetainedGrowth(run.scenarioId) ? retainedMb(heap) : peakGrowthMb(heap)

export const compareRuns = (
    baseline: ResultsFile,
    current: ResultsFile,
    { tolerance = 0.2, floorMs = 2, heapFloorMb = 5 }: CompareOptions = {},
): ComparisonRow[] => {
    const baselineByKey = new Map(baseline.runs.map(run => [run.key, run]))
    const currentKeys = new Set(current.runs.map(run => run.key))

    const rowFor = (
        key: string,
        now: ScenarioRun | null,
        before: ScenarioRun | null,
    ): ComparisonRow => {
        if (!before) {
            return {
                key,
                current: now,
                baseline: null,
                deltaPct: null,
                verdict: 'new',
                heapVerdict: 'new',
            }
        }
        if (!now) {
            return {
                key,
                current: null,
                baseline: before,
                deltaPct: null,
                verdict: 'missing',
                heapVerdict: 'missing',
            }
        }
        if (now.error || before.error) {
            // A run that threw has no numbers to compare, and a run that used
            // to pass and now throws is the regression this tool exists for.
            const verdict = now.error ? 'error' : 'fixed'
            return {
                key,
                current: now,
                baseline: before,
                deltaPct: null,
                verdict,
                heapVerdict: verdict,
            }
        }
        const deltaPct =
            now.timing && before.timing && before.timing.medianMs !== 0
                ? ((now.timing.medianMs - before.timing.medianMs) /
                      before.timing.medianMs) *
                  100
                : null
        return {
            key,
            current: now,
            baseline: before,
            deltaPct,
            verdict:
                now.timing && before.timing
                    ? judge(
                          before.timing.medianMs,
                          now.timing.medianMs,
                          tolerance,
                          floorMs,
                      )
                    : 'same',
            // No heap reading on either side (the runtime has no
            // performance.memory) is not a pass: there is nothing to compare.
            heapVerdict:
                now.heap && before.heap
                    ? judge(
                          heapGrowthOf(before, before.heap),
                          heapGrowthOf(now, now.heap),
                          tolerance,
                          heapFloorMb,
                      )
                    : 'missing',
        }
    }

    return [
        ...current.runs.map(run =>
            rowFor(run.key, run, baselineByKey.get(run.key) ?? null),
        ),
        ...baseline.runs
            .filter(run => !currentKeys.has(run.key))
            .map(run => rowFor(run.key, null, run)),
    ]
}
