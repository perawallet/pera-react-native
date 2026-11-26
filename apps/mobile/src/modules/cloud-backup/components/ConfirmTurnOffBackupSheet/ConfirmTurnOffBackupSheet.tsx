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

import { Trans } from 'react-i18next'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { AccountWithBalance } from '@components/AccountWithBalance'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import {
    PWBottomSheetView,
    PWButton,
    PWIcon,
    PWLoadingIndicator,
    PWSheetLayout,
    PWText,
    PWView,
    type IconName,
    type PWButtonProps,
} from '@components/core'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { ConfirmationCheckbox } from '../ConfirmationCheckbox'
import type { TurnOffBackupChoice } from '../TurnOffBackupSheet'
import { useStyles } from './styles'
import {
    useConfirmTurnOffBackupSheet,
    type ConfirmTurnOffBackupResult,
} from './useConfirmTurnOffBackupSheet'

type ConfirmTurnOffBackupSheetProps = {
    choice: TurnOffBackupChoice
}

type ConfirmCopy = {
    icon: IconName
    titleKey: I18nKey
    bodyKey: I18nKey
    confirmKey: I18nKey
    confirmVariant: PWButtonProps['variant']
    /** Set where the consequence is irreversible: turning off stays
     *  disabled until this is ticked. */
    checkboxKey?: I18nKey
}

const COPY: Record<TurnOffBackupChoice, ConfirmCopy> = {
    turnOff: {
        icon: 'cloud-off',
        titleKey: i18nKey('cloud_backup.turn_off.confirm_title'),
        bodyKey: i18nKey('cloud_backup.turn_off.confirm_body'),
        confirmKey: i18nKey('cloud_backup.turn_off.confirm_button'),
        confirmVariant: 'destructiveLight',
    },
    turnOffAndRemove: {
        icon: 'trash',
        titleKey: i18nKey('cloud_backup.turn_off_and_remove.confirm_title'),
        bodyKey: i18nKey('cloud_backup.turn_off_and_remove.confirm_body'),
        confirmKey: i18nKey('cloud_backup.turn_off_and_remove.confirm_button'),
        confirmVariant: 'destructive',
        checkboxKey: i18nKey(
            'cloud_backup.turn_off_and_remove.confirm_checkbox_label',
        ),
    },
}

export const ConfirmTurnOffBackupSheet = ({
    choice,
}: ConfirmTurnOffBackupSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const copy = COPY[choice]
    const {
        isAcknowledged,
        toggleAcknowledged,
        isTurnOffDisabled,
        isCheckingAccounts,
        accountsAtRisk,
        accountsAtRiskPreferredValue,
        handleTurnOff,
        handleBackUpFirst,
        handleCancel,
    } = useConfirmTurnOffBackupSheet(copy.checkboxKey != null)
    const isAtRisk = accountsAtRisk.length > 0

    // Opened without gorhom's container so the at-risk body can scroll;
    // plain panels need its measuring view or the sheet can't size to them.
    if (isCheckingAccounts) {
        return (
            <PWBottomSheetView>
                <PWView
                    style={styles.loading}
                    testID='confirm_turn_off_backup_sheet'
                >
                    <PWLoadingIndicator
                        size='lg'
                        testID='confirm_turn_off_backup_checking'
                    />
                </PWView>
            </PWBottomSheetView>
        )
    }

    const checkbox = !!copy.checkboxKey && (
        <ConfirmationCheckbox
            label={t(copy.checkboxKey)}
            isConfirmed={isAcknowledged}
            onToggle={toggleAcknowledged}
            testID='confirm_turn_off_backup_checkbox'
        />
    )

    if (!isAtRisk) {
        return (
            <PWBottomSheetView>
                <ConfirmActionContent<ConfirmTurnOffBackupResult>
                    icon={copy.icon}
                    iconVariant='error'
                    title={t(copy.titleKey)}
                    message={t(copy.bodyKey)}
                    isMessageCentered
                    confirmLabel={t(copy.confirmKey)}
                    confirmVariant={copy.confirmVariant}
                    onConfirm={handleTurnOff}
                    isConfirmDisabled={isTurnOffDisabled}
                    cancelLabel={t('common.cancel.label')}
                    onCancel={handleCancel}
                    testID='confirm_turn_off_backup_sheet'
                    confirmTestID='confirm_turn_off_backup_confirm'
                    cancelTestID='confirm_turn_off_backup_cancel'
                >
                    {checkbox}
                </ConfirmActionContent>
            </PWBottomSheetView>
        )
    }

    return (
        <PWSheetLayout
            testID='confirm_turn_off_backup_sheet'
            footer={
                <PWView style={styles.footer}>
                    {checkbox}
                    <PWButton
                        variant='primary'
                        title={t('cloud_backup.turn_off_at_risk.back_up_first')}
                        titleLines={2}
                        onPress={handleBackUpFirst}
                        testID='confirm_turn_off_backup_back_up_first'
                    />
                    <PWButton
                        variant={copy.confirmVariant}
                        title={t(
                            'cloud_backup.turn_off_at_risk.turn_off_anyway',
                        )}
                        titleLines={2}
                        isDisabled={isTurnOffDisabled}
                        onPress={handleTurnOff}
                        testID='confirm_turn_off_backup_turn_off_anyway'
                    />
                    <PWButton
                        variant='linkNeutral'
                        title={t('common.cancel.label')}
                        titleLines={2}
                        onPress={handleCancel}
                        testID='confirm_turn_off_backup_cancel'
                    />
                </PWView>
            }
        >
            <PWIcon
                name={copy.icon}
                variant='error'
                size='xxl'
                style={styles.icon}
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t(copy.titleKey)}
            </PWText>
            <PWText
                variant='body'
                style={styles.message}
            >
                {t(copy.bodyKey)}
            </PWText>
            <PWText
                variant='body'
                style={styles.summary}
                testID='confirm_turn_off_backup_at_risk_summary'
            >
                <Trans
                    i18nKey='cloud_backup.turn_off_at_risk.summary'
                    count={accountsAtRisk.length}
                    components={[
                        <PreferredAmount
                            key='total'
                            value={accountsAtRiskPreferredValue}
                            variant='body'
                            isInline
                        />,
                    ]}
                />
            </PWText>
            <PWView style={styles.accounts}>
                {accountsAtRisk.map(account => (
                    <AccountWithBalance
                        key={account.id}
                        account={account}
                        testID={`confirm_turn_off_backup_at_risk_account_${account.id}`}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
