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

import { useEffect } from 'react'
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import {
    useMigrationSimulatorStore,
    type ResultRow,
} from './useMigrationSimulatorStore'

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
    const loadPlansIfNeeded = useMigrationSimulatorStore(
        state => state.loadPlansIfNeeded,
    )
    useEffect(() => {
        void loadPlansIfNeeded()
    }, [loadPlansIfNeeded])

    const plans = useMigrationSimulatorStore(state => state.plans)
    const isLoadingPlans = useMigrationSimulatorStore(
        state => state.isLoadingPlans,
    )
    const loadError = useMigrationSimulatorStore(state => state.loadError)
    const selectedVersions = useMigrationSimulatorStore(
        state => state.selectedVersions,
    )
    const includeUnroutable = useMigrationSimulatorStore(
        state => state.includeUnroutable,
    )
    const includeAuthState = useMigrationSimulatorStore(
        state => state.includeAuthState,
    )
    const lastGenerated = useMigrationSimulatorStore(
        state => state.lastGenerated,
    )
    const results = useMigrationSimulatorStore(state => state.results)
    const isWorking = useMigrationSimulatorStore(state => state.isWorking)
    const setSelectedVersion = useMigrationSimulatorStore(
        state => state.setSelectedVersion,
    )
    const setIncludeUnroutable = useMigrationSimulatorStore(
        state => state.setIncludeUnroutable,
    )
    const setIncludeAuthState = useMigrationSimulatorStore(
        state => state.setIncludeAuthState,
    )
    const generate = useMigrationSimulatorStore(state => state.generate)
    const generatePreSixxAccounts = useMigrationSimulatorStore(
        state => state.generatePreSixxAccounts,
    )
    const reset = useMigrationSimulatorStore(state => state.reset)

    return {
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
    }
}
