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

import { useEffect } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { getPendingSteps } from '../migrate/stepVersions'
import { useMigrationGateStore } from '../store'

export type UseNeedsMigrationResult = {
    isChecking: boolean
    needsMigration: boolean
    dismiss: () => void
    setSkipped: () => void
}

export const useNeedsMigration = (): UseNeedsMigrationResult => {
    const remoteConfig = useRemoteConfig()
    const isMigrationFeatureEnabled = remoteConfig.getBooleanValue(
        RemoteConfigKeys.pera_7_migration,
        false,
    )

    const isChecking = useMigrationGateStore(state => state.isChecking)
    const needsMigration = useMigrationGateStore(state => state.needsMigration)
    const dismissed = useMigrationGateStore(state => state.dismissed)
    const dismiss = useMigrationGateStore(state => state.dismiss)
    const setSkipped = useMigrationGateStore(state => state.setSkipped)

    useEffect(() => {
        // Synchronously claim the check so concurrent subscribers don't
        // double-fire the platform call.
        const store = useMigrationGateStore.getState()
        if (store.hasStarted) return
        store.markStarted()

        if (store.skipped) {
            logger.info(
                '[Migration] gate skipped (user opted out via "do not show again")',
            )
            store.setStatus({ needsMigration: false })
            return
        }

        if (!isMigrationFeatureEnabled) {
            logger.info(
                '[Migration] gate skipped (pera_7_migration flag disabled)',
            )
            store.setStatus({ needsMigration: false })
            return
        }

        const migration = getProvider().migration
        Promise.all([migration.hasLegacyData(), getPendingSteps(migration)])
            .then(([hasLegacyData, pendingSteps]) => {
                useMigrationGateStore.getState().setStatus({
                    needsMigration: hasLegacyData && pendingSteps.length > 0,
                })
            })
            .catch(error => {
                logger.error('[Migration] gate check failed', { error })
                useMigrationGateStore
                    .getState()
                    .setStatus({ needsMigration: false })
            })
    }, [isMigrationFeatureEnabled])

    return {
        isChecking,
        needsMigration: needsMigration && !dismissed,
        dismiss,
        setSkipped,
    }
}
