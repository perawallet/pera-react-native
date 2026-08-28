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
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type TurnOffBackupChoice = 'turnOff' | 'turnOffAndRemove'

export const TurnOffBackupSheet = () => {
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<TurnOffBackupChoice>()

    return (
        <ConfirmActionContent<TurnOffBackupChoice>
            icon='cloud-off'
            iconVariant='error'
            title={t('cloud_backup.turn_off_sheet.title')}
            message={t('cloud_backup.turn_off_sheet.description')}
            confirmLabel={t('cloud_backup.turn_off_sheet.keep_enabled')}
            confirmVariant='primary'
            onConfirm={dismiss}
            cancelLabel={t('cloud_backup.turn_off_sheet.turn_off')}
            cancelVariant='secondary'
            onCancel={() => resolve('turnOff')}
            tertiaryLabel={t('cloud_backup.turn_off_sheet.turn_off_and_remove')}
            tertiaryVariant='errorLink'
            onTertiary={() => resolve('turnOffAndRemove')}
        />
    )
}
