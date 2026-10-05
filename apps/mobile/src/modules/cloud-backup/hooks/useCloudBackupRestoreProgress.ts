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

import {
    useCloudBackupRestoreProgressStore,
    type RestoreProgress,
} from '@perawallet/wallet-core-backup'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

type Translate = ReturnType<typeof useLanguage>['t']

export type UseCloudBackupRestoreProgressResult = {
    title: string
    description: string
}

const PHASE_TITLE_KEYS = {
    unlocking: 'cloud_backup.restore.progress_unlocking',
    downloading: 'cloud_backup.restore.progress_downloading',
    importing: 'cloud_backup.restore.progress_importing',
    finishing: 'cloud_backup.restore.progress_finishing',
} as const satisfies Record<RestoreProgress['phase'], string>

const titleFor = (
    t: Translate,
    progress: Nullable<RestoreProgress>,
): string => {
    if (progress === null) return t('cloud_backup.restore.restoring')
    if (progress.phase === 'importing') {
        return t(PHASE_TITLE_KEYS.importing, {
            done: progress.done,
            total: progress.total,
        })
    }
    return t(PHASE_TITLE_KEYS[progress.phase])
}

export const useCloudBackupRestoreProgress =
    (): UseCloudBackupRestoreProgressResult => {
        const { t } = useLanguage()
        const progress = useCloudBackupRestoreProgressStore(
            state => state.progress,
        )

        return {
            title: titleFor(t, progress),
            description: t('cloud_backup.restore.progress_hint'),
        }
    }
