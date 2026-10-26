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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { compareRuns, isComparable } from '../runner/compare'
import { buildRunMeta } from '../runner/runMeta'
import { runSelection } from '../runner/runSelection'
import {
    exportResults,
    importBaselineFromClipboard,
    loadBaseline,
    loadLatest,
    saveBaseline,
    saveLatest,
} from '../runner/resultsStore'
import { BENCH_SCALES } from '../runner/scales'
import { AVAILABLE_SCENARIOS } from './availableScenarios'
import type {
    BenchScaleName,
    ComparisonRow,
    ResultsFile,
    ScenarioContext,
} from '../runner/types'

export type BenchProgress = { done: number; total: number; current: string }

export type UseBenchRunnerResult = {
    selectedScales: BenchScaleName[]
    setSelectedScales: (scales: BenchScaleName[]) => void
    isRunning: boolean
    progress: BenchProgress | null
    latest: ResultsFile | null
    baseline: ResultsFile | null
    /** Null when there is nothing to compare, or the two runs are not comparable. */
    comparison: ComparisonRow[] | null
    /** Why there is no comparison, when a baseline exists. */
    comparisonNote: string | null
    error: string | null
    runScenarios: (ids: string[]) => Promise<void>
    runAll: () => Promise<void>
    saveAsBaseline: () => void
    exportLatest: () => Promise<void>
    importBaseline: () => Promise<void>
}

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

/**
 * `getContext` is read when a run starts, not held in this component's props:
 * the scenario context subscribes to production stores, and a render it caused
 * here would land on the JS thread in the middle of a timed run.
 */
export const useBenchRunner = (
    getContext: () => ScenarioContext,
): UseBenchRunnerResult => {
    const [selectedScales, setSelectedScales] = useState<BenchScaleName[]>([
        'S',
    ])
    const [isRunning, setIsRunning] = useState(false)
    const [progress, setProgress] = useState<BenchProgress | null>(null)
    const [latest, setLatest] = useState<ResultsFile | null>(null)
    const [baseline, setBaseline] = useState<ResultsFile | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        try {
            setLatest(loadLatest())
            setBaseline(loadBaseline())
        } catch (cause) {
            setError(messageOf(cause))
        }
    }, [])

    const runScenarios = useCallback(
        async (ids: string[]) => {
            setError(null)
            setIsRunning(true)
            try {
                const entries = AVAILABLE_SCENARIOS.filter(s =>
                    ids.includes(s.id),
                ).flatMap(scenario =>
                    selectedScales
                        .filter(name => scenario.scales.includes(name))
                        .map(name => ({ scenario, scale: BENCH_SCALES[name] })),
                )
                const meta = buildRunMeta()
                const runs = await runSelection(
                    entries,
                    getContext(),
                    (done, total, current) =>
                        setProgress({ done, total, current }),
                )
                const results: ResultsFile = { version: 1, meta, runs }
                saveLatest(results)
                setLatest(results)
            } catch (cause) {
                setError(messageOf(cause))
            } finally {
                setProgress(null)
                setIsRunning(false)
            }
        },
        [selectedScales, getContext],
    )

    const runAll = useCallback(
        () =>
            runScenarios(
                AVAILABLE_SCENARIOS.filter(scenario => !scenario.isLong).map(
                    scenario => scenario.id,
                ),
            ),
        [runScenarios],
    )

    const saveAsBaseline = useCallback(() => {
        if (!latest) return
        saveBaseline(latest)
        setBaseline(latest)
    }, [latest])

    const exportLatest = useCallback(async () => {
        if (!latest) return
        try {
            await exportResults(latest)
        } catch (cause) {
            setError(messageOf(cause))
        }
    }, [latest])

    const importBaseline = useCallback(async () => {
        try {
            const imported = await importBaselineFromClipboard()
            saveBaseline(imported)
            setBaseline(imported)
            setError(null)
        } catch (cause) {
            setError(messageOf(cause))
        }
    }, [])

    const { comparison, comparisonNote } = useMemo(() => {
        if (!latest || !baseline) {
            return { comparison: null, comparisonNote: null }
        }
        if (!isComparable(baseline.meta, latest.meta)) {
            return {
                comparison: null,
                comparisonNote:
                    'Not comparable: the baseline was made on another device, OS, build type, chain set or scale table.',
            }
        }
        return {
            comparison: compareRuns(baseline, latest),
            comparisonNote: null,
        }
    }, [latest, baseline])

    return {
        selectedScales,
        setSelectedScales,
        isRunning,
        progress,
        latest,
        baseline,
        comparison,
        comparisonNote,
        error,
        runScenarios,
        runAll,
        saveAsBaseline,
        exportLatest,
        importBaseline,
    }
}
