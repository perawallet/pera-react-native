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

type DeleteFromBackupSheetProps = {
    /** Overrides the cancel label where declining is not "abort" but "keep the
     *  backup's copy". */
    cancelLabel?: string
    onConfirm?: () => void
    onCancel?: () => void
}

export const DeleteFromBackupSheet = ({
    cancelLabel,
    onConfirm,
    onCancel,
}: DeleteFromBackupSheetProps = {}) => {
    const { t } = useLanguage()

    return (
        <ConfirmActionContent
            icon='cloud-off'
            iconVariant='error'
            title={t('cloud_backup.accounts.delete_sheet_title')}
            message={t('cloud_backup.accounts.delete_sheet_body')}
            isMessageCentered
            confirmLabel={t('cloud_backup.accounts.delete_sheet_confirm')}
            confirmVariant='destructiveLight'
            cancelLabel={
                cancelLabel ?? t('cloud_backup.accounts.delete_sheet_cancel')
            }
            cancelVariant='secondary'
            onConfirm={onConfirm}
            onCancel={onCancel}
            testID='delete_from_backup_sheet'
            confirmTestID='delete_from_backup_confirm'
            cancelTestID='delete_from_backup_cancel'
        />
    )
}
