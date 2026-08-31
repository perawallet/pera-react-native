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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import { useSyncStatusBadgeStyles } from './styles'
import type { SyncBadge } from './useCloudBackupOverview'

const STATUS_LABEL_KEY: Record<SyncBadge, string> = {
    success: 'cloud_backup.overview.status_success',
    failed: 'cloud_backup.overview.status_failed',
    syncing: 'cloud_backup.overview.status_syncing',
}

type SyncStatusBadgeProps = {
    status: SyncBadge
}

export const SyncStatusBadge = ({ status }: SyncStatusBadgeProps) => {
    const { t } = useLanguage()
    const styles = useSyncStatusBadgeStyles({ status })

    return (
        <PWView
            style={styles.container}
            {...getTestProps(`cloud_backup_sync_status_${status}`)}
        >
            <PWText
                variant='captionMedium'
                weight={700}
                style={styles.text}
            >
                {t(STATUS_LABEL_KEY[status])}
            </PWText>
        </PWView>
    )
}
