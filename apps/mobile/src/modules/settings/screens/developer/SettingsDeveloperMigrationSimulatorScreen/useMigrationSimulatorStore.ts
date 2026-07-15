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

import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { create } from 'zustand'

export type SimulationOutcome =
    | { kind: 'pending' }
    | { kind: 'success'; version: number; at: number }
    | { kind: 'done'; detail: string; at: number }
    | { kind: 'error'; message: string }

export type ResultRow = {
    dbName: string
    outcome: SimulationOutcome
}

type MigrationSimulatorState = {
    plans: MigrationPlanSummary[]
    isLoadingPlans: boolean
    hasLoadedPlans: boolean
    loadError: Error | null
    selectedVersions: Record<string, number>
    includeUnroutable: boolean
    includeAuthState: boolean
    lastGenerated: Record<string, { version: number; at: number }>
    results: ResultRow[]
    isWorking: boolean
}

type MigrationSimulatorActions = {
    loadPlansIfNeeded: () => Promise<void>
    setSelectedVersion: (dbName: string, version: number) => void
    setIncludeUnroutable: (value: boolean) => void
    setIncludeAuthState: (value: boolean) => void
    generate: () => Promise<void>
    generatePreSixxAccounts: () => Promise<void>
    reset: () => Promise<void>
    resetState: () => void
}

type MigrationSimulatorStore = MigrationSimulatorState &
    MigrationSimulatorActions

const initialState: MigrationSimulatorState = {
    plans: [],
    isLoadingPlans: true,
    hasLoadedPlans: false,
    loadError: null,
    selectedVersions: {},
    includeUnroutable: false,
    includeAuthState: false,
    lastGenerated: {},
    results: [],
    isWorking: false,
}

let loadInFlight = false

export const useMigrationSimulatorStore = create<MigrationSimulatorStore>()(
    (set, get) => ({
        ...initialState,
        loadPlansIfNeeded: async () => {
            if (get().hasLoadedPlans || loadInFlight) return
            loadInFlight = true
            try {
                const result = await getProvider().migration.getMigrationPlans()
                const defaults: Record<string, number> = {}
                for (const p of result) {
                    defaults[p.dbName] = p.oldestSupported
                }
                set({
                    plans: result,
                    selectedVersions: defaults,
                    isLoadingPlans: false,
                    hasLoadedPlans: true,
                })
            } catch (err) {
                set({
                    loadError:
                        err instanceof Error ? err : new Error(String(err)),
                    isLoadingPlans: false,
                    hasLoadedPlans: true,
                })
            } finally {
                loadInFlight = false
            }
        },
        setSelectedVersion: (dbName, version) => {
            set(state => ({
                selectedVersions: {
                    ...state.selectedVersions,
                    [dbName]: version,
                },
            }))
        },
        setIncludeUnroutable: value => set({ includeUnroutable: value }),
        setIncludeAuthState: value => set({ includeAuthState: value }),
        generate: async () => {
            const {
                plans,
                selectedVersions,
                includeUnroutable,
                includeAuthState,
            } = get()
            if (plans.length === 0) return
            set({
                isWorking: true,
                results: plans.map(plan => ({
                    dbName: plan.dbName,
                    outcome: { kind: 'pending' } as const,
                })),
            })
            const migration = getProvider().migration
            const next: ResultRow[] = []
            const successful: Record<string, { version: number; at: number }> =
                {}
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
                                err instanceof Error
                                    ? err.message
                                    : String(err),
                        },
                    })
                }
            }
            set(state => ({
                results: next,
                lastGenerated: { ...state.lastGenerated, ...successful },
                isWorking: false,
            }))
        },
        generatePreSixxAccounts: async () => {
            set({ isWorking: true })
            try {
                await getProvider().migration.simulatePreSixxAccounts()
                set({
                    results: [
                        {
                            dbName: 'pre-6.x accounts',
                            outcome: {
                                kind: 'done',
                                detail: 'blob written',
                                at: Date.now(),
                            },
                        },
                    ],
                })
            } catch (err) {
                set({
                    results: [
                        {
                            dbName: 'pre-6.x accounts',
                            outcome: {
                                kind: 'error',
                                message:
                                    err instanceof Error
                                        ? err.message
                                        : String(err),
                            },
                        },
                    ],
                })
            } finally {
                set({ isWorking: false })
            }
        },
        reset: async () => {
            set({ isWorking: true })
            try {
                await getProvider().migration.resetLegacyData()
                const plans = get().plans
                set({
                    lastGenerated: {},
                    results: plans.map(plan => ({
                        dbName: plan.dbName,
                        outcome: {
                            kind: 'success',
                            version: 0,
                            at: Date.now(),
                        } as const,
                    })),
                })
            } catch (err) {
                set({
                    results: [
                        {
                            dbName: 'reset',
                            outcome: {
                                kind: 'error',
                                message:
                                    err instanceof Error
                                        ? err.message
                                        : String(err),
                            },
                        },
                    ],
                })
            } finally {
                set({ isWorking: false })
            }
        },
        resetState: () => {
            loadInFlight = false
            set(initialState)
        },
    }),
)
