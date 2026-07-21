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

import { useCallback, useEffect, useState } from 'react'
import {
    ALL_MIGRATION_STEPS,
    MIGRATION_STEP_TARGET_VERSIONS,
    getPendingSteps,
    resolveCompletedStepVersions,
} from '@perawallet/wallet-core-migrate'
import type { MigrationStepName } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type MigrationStepRow = {
    name: MigrationStepName
    recorded: number
    target: number
    isPending: boolean
}

export type UseMigrationStepVersionsResult = {
    steps: MigrationStepRow[]
    isLoading: boolean
    refresh: () => void
}

/**
 * Mirrors the `[Migration] step versions` diagnostic (see
 * `runMigration.ts`'s `logStepVersions`) for the dev viewer: reads the same
 * `resolveCompletedStepVersions` + `MIGRATION_STEP_TARGET_VERSIONS` +
 * `getPendingSteps` used to decide what re-runs on next launch, so support
 * can see exactly what a device would log without needing a fresh run.
 */
export const useMigrationStepVersions = (): UseMigrationStepVersionsResult => {
    const [steps, setSteps] = useState<MigrationStepRow[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const load = useCallback(async () => {
        setIsLoading(true)
        try {
            const migration = getProvider().migration
            const [completed, pending] = await Promise.all([
                resolveCompletedStepVersions(migration),
                getPendingSteps(migration),
            ])
            const pendingSteps = new Set(pending)
            setSteps(
                ALL_MIGRATION_STEPS.map(name => ({
                    name,
                    recorded: completed[name] ?? 0,
                    target: MIGRATION_STEP_TARGET_VERSIONS[name],
                    isPending: pendingSteps.has(name),
                })),
            )
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    return { steps, isLoading, refresh: () => void load() }
}
