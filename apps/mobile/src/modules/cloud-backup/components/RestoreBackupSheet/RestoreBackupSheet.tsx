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

import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'

export type RestoreBackupSheetResult = 'continue'

export const RestoreBackupSheet = () => {
    const { t } = useLanguage()

    return (
        <ConfirmActionContent<RestoreBackupSheetResult>
            icon='cloud-download'
            iconVariant='positive'
            title={t('cloud_backup.restore.sheet_title')}
            message={t('cloud_backup.restore.sheet_description')}
            confirmLabel={t('cloud_backup.restore.sheet_continue')}
            confirmValue='continue'
            confirmTestID='cloud_backup_restore_sheet_continue'
        />
    )
}
