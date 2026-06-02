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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type SimulationOutcome =
    | { kind: 'pending' }
    | { kind: 'success'; version: number; at: number }
    | { kind: 'done'; detail: string; at: number }
    | { kind: 'error'; message: string }

export type ResultRow = {
    dbName: string
    outcome: SimulationOutcome
}

type UseMigrationSimulatorResult = {
    plans: MigrationPlanSummary[]
    isLoadingPlans: boolean
    loadError: Error | null
    selectedVersions: Record<string, number>
    setSelectedVersion: (dbName: string, version: number) => void
    includeUnroutable: boolean
    setIncludeUnroutable: (value: boolean) => void
    includeAuthState: boolean
    setIncludeAuthState: (value: boolean) => void
    lastGenerated: Record<string, { version: number; at: number }>
    results: ResultRow[]
    isWorking: boolean
    generate: () => Promise<void>
    generatePreSixxAccounts: () => Promise<void>
    reset: () => Promise<void>
}

export const useMigrationSimulator = (): UseMigrationSimulatorResult => {
    const [plans, setPlans] = useState<MigrationPlanSummary[]>([])
    const [isLoadingPlans, setIsLoadingPlans] = useState(true)
    const [loadError, setLoadError] = useState<Error | null>(null)
    const [selectedVersions, setSelectedVersions] = useState<
        Record<string, number>
    >({})
    const [lastGenerated, setLastGenerated] = useState<
        Record<string, { version: number; at: number }>
    >({})
    const [results, setResults] = useState<ResultRow[]>([])
    const [isWorking, setIsWorking] = useState(false)
    const [includeUnroutable, setIncludeUnroutable] = useState(false)
    const [includeAuthState, setIncludeAuthState] = useState(false)

    useEffect(() => {
        let cancelled = false
        getProvider()
            .migration.getMigrationPlans()
            .then(result => {
                if (cancelled) return
                setPlans(result)
                const defaults: Record<string, number> = {}
                for (const p of result) {
                    defaults[p.dbName] = p.oldestSupported
                }
                setSelectedVersions(defaults)
                setIsLoadingPlans(false)
            })
            .catch(err => {
                if (cancelled) return
                setLoadError(
                    err instanceof Error ? err : new Error(String(err)),
                )
                setIsLoadingPlans(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const setSelectedVersion = useCallback(
        (dbName: string, version: number) => {
            setSelectedVersions(prev => ({ ...prev, [dbName]: version }))
        },
        [],
    )

    const generate = useCallback(async () => {
        if (plans.length === 0) return
        setIsWorking(true)
        setResults(
            plans.map(plan => ({
                dbName: plan.dbName,
                outcome: { kind: 'pending' } as const,
            })),
        )
        const migration = getProvider().migration
        const next: ResultRow[] = []
        const successful: Record<string, { version: number; at: number }> = {}
        for (const plan of plans) {
            const version =
                selectedVersions[plan.dbName] ?? plan.oldestSupported
            try {
                await migration.simulateLegacyDatabase({
                    dbName: plan.dbName,
                    version,
                    includeUnroutableAccounts: includeUnroutable,
                    includeAuthState,
                })
                const at = Date.now()
                next.push({
                    dbName: plan.dbName,
                    outcome: { kind: 'success', version, at },
                })
                successful[plan.dbName] = { version, at }
            } catch (err) {
                next.push({
                    dbName: plan.dbName,
                    outcome: {
                        kind: 'error',
                        message:
                            err instanceof Error ? err.message : String(err),
                    },
                })
            }
        }
        setResults(next)
        setLastGenerated(prev => ({ ...prev, ...successful }))
        setIsWorking(false)
    }, [plans, selectedVersions, includeUnroutable, includeAuthState])

    const generatePreSixxAccounts = useCallback(async () => {
        setIsWorking(true)
        try {
            await getProvider().migration.simulatePreSixxAccounts()
            setResults([
                {
                    dbName: 'pre-6.x accounts',
                    outcome: {
                        kind: 'done',
                        detail: 'blob written',
                        at: Date.now(),
                    },
                },
            ])
        } catch (err) {
            setResults([
                {
                    dbName: 'pre-6.x accounts',
                    outcome: {
                        kind: 'error',
                        message:
                            err instanceof Error ? err.message : String(err),
                    },
                },
            ])
        }
        setIsWorking(false)
    }, [])

    const reset = useCallback(async () => {
        setIsWorking(true)
        try {
            await getProvider().migration.resetLegacyData()
            setLastGenerated({})
            setResults(
                plans.map(plan => ({
                    dbName: plan.dbName,
                    outcome: {
                        kind: 'success',
                        version: 0,
                        at: Date.now(),
                    } as const,
                })),
            )
        } catch (err) {
            setResults([
                {
                    dbName: 'reset',
                    outcome: {
                        kind: 'error',
                        message:
                            err instanceof Error ? err.message : String(err),
                    },
                },
            ])
        }
        setIsWorking(false)
    }, [plans])

    return useMemo(
        () => ({
            plans,
            isLoadingPlans,
            loadError,
            selectedVersions,
            setSelectedVersion,
            includeUnroutable,
            setIncludeUnroutable,
            includeAuthState,
            setIncludeAuthState,
            lastGenerated,
            results,
            isWorking,
            generate,
            generatePreSixxAccounts,
            reset,
        }),
        [
            plans,
            isLoadingPlans,
            loadError,
            selectedVersions,
            setSelectedVersion,
            includeUnroutable,
            setIncludeUnroutable,
            includeAuthState,
            setIncludeAuthState,
            lastGenerated,
            results,
            isWorking,
            generate,
            generatePreSixxAccounts,
            reset,
        ],
    )
}
