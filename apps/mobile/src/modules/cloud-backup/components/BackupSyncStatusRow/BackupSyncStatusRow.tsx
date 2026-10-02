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

import type { IconName, PWIconVariant } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useBackupSyncStatus,
    type SyncBadge,
} from '../../hooks/useBackupSyncStatus'
import { OverviewRow } from '../OverviewRow'
import { SyncStatusBadge } from '../SyncStatusBadge'

type SyncIcon = { name: IconName; variant: PWIconVariant }

const SYNC_ICON: Record<SyncBadge, SyncIcon> = {
    success: { name: 'cloud-check', variant: 'positive' },
    failed: { name: 'cloud-x', variant: 'error' },
    syncing: { name: 'cloud-check', variant: 'secondary' },
}

const NEVER_SYNCED_ICON: SyncIcon = { name: 'cloud-off', variant: 'secondary' }

export const BackupSyncStatusRow = () => {
    const { t } = useLanguage()
    const { syncStatus, lastSyncedLabel } = useBackupSyncStatus()
    const icon = syncStatus ? SYNC_ICON[syncStatus] : NEVER_SYNCED_ICON

    return (
        <OverviewRow
            variant='bordered'
            icon={icon.name}
            iconVariant={icon.variant}
            title={t('cloud_backup.overview.latest_sync')}
            subtitle={lastSyncedLabel}
            // Room for the "last successful sync" prefix beside a FAILED badge.
            subtitleLines={2}
            trailing={
                syncStatus ? <SyncStatusBadge status={syncStatus} /> : undefined
            }
            testID='cloud_backup_overview_latest_sync'
        />
    )
}
