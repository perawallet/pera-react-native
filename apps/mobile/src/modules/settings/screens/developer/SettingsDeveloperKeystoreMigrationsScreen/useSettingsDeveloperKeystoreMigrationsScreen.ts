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

import { useCallback, useState } from 'react'
import {
    KEYSTORE_MIGRATION_MODULES,
    readKeystoreMigrationLedger,
    resetKeystoreMigrationModule,
} from '@perawallet/wallet-extension-provider'

export type KeystoreMigrationModuleState = {
    id: string
    label: string
    revision: { id: number; name: string; appliedAt: string } | null
}

export type UseSettingsDeveloperKeystoreMigrationsScreenResult = {
    modules: KeystoreMigrationModuleState[]
    refresh: () => void
    resetModule: (moduleId: string) => void
}

const buildModules = (): KeystoreMigrationModuleState[] => {
    const ledger = readKeystoreMigrationLedger()
    return KEYSTORE_MIGRATION_MODULES.map(({ id, label }) => ({
        id,
        label,
        revision: ledger[id] ?? null,
    }))
}

export const useSettingsDeveloperKeystoreMigrationsScreen =
    (): UseSettingsDeveloperKeystoreMigrationsScreenResult => {
        const [modules, setModules] =
            useState<KeystoreMigrationModuleState[]>(buildModules)

        const refresh = useCallback(() => setModules(buildModules()), [])

        const resetModule = useCallback((moduleId: string) => {
            resetKeystoreMigrationModule(moduleId)
            setModules(buildModules())
        }, [])

        return { modules, refresh, resetModule }
    }
