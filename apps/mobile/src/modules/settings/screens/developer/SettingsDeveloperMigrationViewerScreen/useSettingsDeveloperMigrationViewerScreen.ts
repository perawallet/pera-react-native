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

import { useCallback, useEffect, useState } from 'react'
import type { LegacyMigrationData } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type UseSettingsDeveloperMigrationViewerScreenResult = {
    data: LegacyMigrationData | null
    isLoading: boolean
    error: Error | null
    isMigrationComplete: boolean
    refresh: () => void
}

export const useSettingsDeveloperMigrationViewerScreen =
    (): UseSettingsDeveloperMigrationViewerScreenResult => {
        const [data, setData] = useState<LegacyMigrationData | null>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [error, setError] = useState<Error | null>(null)
        const [isMigrationComplete, setIsMigrationComplete] = useState(false)

        const load = useCallback(async () => {
            setIsLoading(true)
            setError(null)
            try {
                const migration = getProvider().migration
                const [payload, complete] = await Promise.all([
                    migration.getLegacyData(),
                    migration.isMigrationComplete(),
                ])
                setData(payload)
                setIsMigrationComplete(complete)
            } catch (e) {
                setError(e instanceof Error ? e : new Error(String(e)))
            } finally {
                setIsLoading(false)
            }
        }, [])

        useEffect(() => {
            load()
        }, [load])

        return { data, isLoading, error, isMigrationComplete, refresh: load }
    }
