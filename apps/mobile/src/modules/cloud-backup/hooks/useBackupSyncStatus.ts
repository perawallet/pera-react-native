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

import { useMemo } from 'react'
import {
    deriveBackupSyncStatus,
    useBackupSyncStateStore,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import {
    formatDatetime,
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupSync } from './useBackupSync'

export type SyncBadge = 'success' | 'failed' | 'syncing'

export type UseBackupSyncStatusResult = {
    syncStatus: Nullable<SyncBadge>
    lastSyncedLabel: string
}

type BackupSyncStatus = ReturnType<typeof deriveBackupSyncStatus>

// A pull of another device's change holds the slot for ~0.1 s; without this
// the badge would flash SYNCING on every one. A real sync runs for seconds.
const SYNCING_SETTLE_MS = 500

/** `null` renders no badge: a backup that has never synced is neither in sync
 *  nor syncing, and there is no fourth badge to say so. */
const STATUS_TO_BADGE: Record<BackupSyncStatus, Nullable<SyncBadge>> = {
    idle: null,
    pending: null,
    syncing: 'syncing',
    upToDate: 'success',
    error: 'failed',
}

const formatSyncedAt = (millis: Nullable<number>): string => {
    if (millis == null) return '—'
    return formatDatetime(new Date(millis), undefined, 'medium')
}

export const useBackupSyncStatus = (): UseBackupSyncStatusResult => {
    const { isSyncing } = useBackupSync()
    const isSyncingSettled = useDebouncedValue(isSyncing, SYNCING_SETTLE_MS)
    const backupId = useCloudBackupStore(state => state.backupId)
    const syncState = useBackupSyncStateStore(state => state.syncState)

    const status = deriveBackupSyncStatus({
        isConfigured: backupId != null,
        isSyncing: isSyncingSettled,
        lastSyncResult: syncState?.lastSyncResult ?? null,
    })

    const { t } = useLanguage()
    const syncStatus = STATUS_TO_BADGE[status]
    const lastSyncedAt = syncState?.lastSyncedAt ?? null
    // The time only moves on success, so beside FAILED it has to say so or it
    // reads as the moment of the failure.
    const isFailedSinceLastSuccess =
        syncStatus === 'failed' && lastSyncedAt != null
    const lastSyncedLabel = useMemo(() => {
        const formatted = formatSyncedAt(lastSyncedAt)
        return isFailedSinceLastSuccess
            ? t('cloud_backup.overview.last_successful_sync', {
                  date: formatted,
              })
            : formatted
    }, [lastSyncedAt, isFailedSinceLastSuccess, t])

    return { syncStatus, lastSyncedLabel }
}
