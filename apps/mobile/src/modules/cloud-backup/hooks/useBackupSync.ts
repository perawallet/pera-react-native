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

import { useCallback } from 'react'
import {
    getBackupSyncManager,
    useBackupSyncActivityStore,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'

type UseBackupSyncResult = {
    syncNow: () => Promise<void>
    isSyncing: boolean
}

export const useBackupSync = (): UseBackupSyncResult => {
    // The manager owns the flag, so a periodic tick, an account-change sync or
    // a socket-driven pull shows here too — not only the runs this hook starts.
    const isSyncing = useBackupSyncActivityStore(state => state.isSyncing)

    const syncNow = useCallback(async (): Promise<void> => {
        try {
            await getBackupSyncManager().syncNow()
        } catch (error) {
            logger.warn('useBackupSync: manual sync failed', {
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }, [])

    return { syncNow, isSyncing }
}
