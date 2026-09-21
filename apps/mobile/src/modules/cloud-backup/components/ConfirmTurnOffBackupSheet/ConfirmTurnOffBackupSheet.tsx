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
import type { IconName, PWButtonProps } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ConfirmationCheckbox } from '../ConfirmationCheckbox'
import type { TurnOffBackupChoice } from '../TurnOffBackupSheet'
import { useConfirmTurnOffBackupSheet } from './useConfirmTurnOffBackupSheet'

type ConfirmTurnOffBackupSheetProps = {
    choice: TurnOffBackupChoice
}

type ConfirmCopy = {
    icon: IconName
    titleKey: string
    bodyKey: string
    confirmKey: string
    confirmVariant: PWButtonProps['variant']
    /** Set where the consequence is irreversible: the confirm button stays
     *  disabled until this is ticked. */
    checkboxKey?: string
}

const COPY: Record<TurnOffBackupChoice, ConfirmCopy> = {
    turnOff: {
        icon: 'cloud-off',
        titleKey: 'cloud_backup.turn_off.confirm_title',
        bodyKey: 'cloud_backup.turn_off.confirm_body',
        confirmKey: 'cloud_backup.turn_off.confirm_button',
        confirmVariant: 'destructiveLight',
    },
    turnOffAndRemove: {
        icon: 'trash',
        titleKey: 'cloud_backup.turn_off_and_remove.confirm_title',
        bodyKey: 'cloud_backup.turn_off_and_remove.confirm_body',
        confirmKey: 'cloud_backup.turn_off_and_remove.confirm_button',
        confirmVariant: 'destructive',
        checkboxKey: 'cloud_backup.turn_off_and_remove.confirm_checkbox_label',
    },
}

export const ConfirmTurnOffBackupSheet = ({
    choice,
}: ConfirmTurnOffBackupSheetProps) => {
    const { t } = useLanguage()
    const copy = COPY[choice]
    const { isAcknowledged, isConfirmDisabled, toggleAcknowledged } =
        useConfirmTurnOffBackupSheet(copy.checkboxKey != null)

    return (
        <ConfirmActionContent
            icon={copy.icon}
            iconVariant='error'
            title={t(copy.titleKey)}
            message={t(copy.bodyKey)}
            isMessageCentered
            confirmLabel={t(copy.confirmKey)}
            confirmVariant={copy.confirmVariant}
            isConfirmDisabled={isConfirmDisabled}
            cancelLabel={t('common.cancel.label')}
            testID='confirm_turn_off_backup_sheet'
            confirmTestID='confirm_turn_off_backup_confirm'
            cancelTestID='confirm_turn_off_backup_cancel'
        >
            {!!copy.checkboxKey && (
                <ConfirmationCheckbox
                    label={t(copy.checkboxKey)}
                    isConfirmed={isAcknowledged}
                    onToggle={toggleAcknowledged}
                    testID='confirm_turn_off_backup_checkbox'
                />
            )}
        </ConfirmActionContent>
    )
}
