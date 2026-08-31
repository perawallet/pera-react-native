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
import { getBackupSyncManager } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'

type UseBackupSyncResult = {
    syncNow: () => Promise<void>
    isSyncing: boolean
}

export const useBackupSync = (): UseBackupSyncResult => {
    const [isSyncing, setIsSyncing] = useState(false)

    const syncNow = useCallback(async (): Promise<void> => {
        setIsSyncing(true)
        try {
            await getBackupSyncManager().syncNow()
        } catch (error) {
            logger.warn('useBackupSync: manual sync failed', {
                error: error instanceof Error ? error.message : String(error),
            })
        } finally {
            setIsSyncing(false)
        }
    }, [])

    return { syncNow, isSyncing }
}
