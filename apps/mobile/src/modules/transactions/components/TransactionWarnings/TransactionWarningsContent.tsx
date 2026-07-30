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
    PWDivider,
    PWRoundIcon,
    PWSheetLayout,
    PWText,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    LONG_ADDRESS_LENGTH,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useTheme } from '@rneui/themed'
import { useTransactionWarnings } from './useTransactionWarnings'

export type TransactionWarningsContentProps = {
    transaction: PeraDisplayableTransaction
}

export const TransactionWarningsContent = ({
    transaction,
}: TransactionWarningsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()

    const { warningCount, warningsByType } = useTransactionWarnings(transaction)

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('transactions.warning.title', {
                        count: warningCount,
                    })}
                />
            }
        >
            {warningsByType.close.map((warning, index) => (
                <PWView
                    key={`close-${warning.senderAddress}`}
                    style={styles.warningSection}
                >
                    {index > 0 && (
                        <PWDivider
                            style={styles.divider}
                            color={theme.colors.layerGray}
                        />
                    )}
                    <PWView style={styles.warningSectionIconContainer}>
                        <PWRoundIcon
                            icon='trash'
                            size='md'
                            variant='secondary'
                        />
                        <PWText style={styles.warningMessage}>
                            {t('transactions.warning.close_warning', {
                                address: truncateAlgorandAddress(
                                    warning.targetAddress,
                                    LONG_ADDRESS_LENGTH,
                                ),
                            })}
                        </PWText>
                    </PWView>
                </PWView>
            ))}
            {warningsByType.close.length > 0 &&
                warningsByType.rekey.length > 0 && (
                    <PWDivider
                        style={styles.divider}
                        color={theme.colors.layerGray}
                    />
                )}
            {warningsByType.rekey.map((warning, index) => (
                <PWView
                    key={`rekey-${warning.senderAddress}`}
                    style={styles.warningSection}
                >
                    {index > 0 && (
                        <PWDivider
                            style={styles.divider}
                            color={theme.colors.layerGray}
                        />
                    )}
                    <PWView style={styles.warningSectionIconContainer}>
                        <PWRoundIcon
                            icon='rekey'
                            size='md'
                            variant='secondary'
                        />
                        <PWView style={styles.warningMessageContainer}>
                            <PWText style={styles.warningMessage}>
                                {t('transactions.warning.rekey_warning', {
                                    address: truncateAlgorandAddress(
                                        warning.targetAddress,
                                        LONG_ADDRESS_LENGTH,
                                    ),
                                })}
                            </PWText>
                            <PWText variant='h4'>
                                {t('transactions.warning.rekey_warning_bold')}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            ))}
        </PWSheetLayout>
    )
}
