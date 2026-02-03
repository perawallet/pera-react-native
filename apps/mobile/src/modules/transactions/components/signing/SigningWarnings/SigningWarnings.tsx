/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    PWBottomSheet,
    PWDivider,
    PWIcon,
    PWRoundIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useTheme } from '@rneui/themed'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { LONG_ADDRESS_FORMAT } from '@constants/ui'
import { useStyles } from './styles'
import { useTransactionSigningContext } from '@modules/transactions/hooks/signing/useTransactionSigning'
import { TransactionWarning } from '@modules/transactions/models'

type WarningItemProps = {
    warning: TransactionWarning
    showDivider: boolean
}

const WarningItem = ({ warning, showDivider }: WarningItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const isClose = warning.type === 'close'
    const icon = isClose ? 'trash' : 'rekey'
    const messageKey = isClose
        ? 'transactions.warning.close_warning'
        : 'transactions.warning.rekey_warning'

    return (
        <>
            {showDivider && (
                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />
            )}
            <PWView style={styles.warningSection}>
                <PWView style={styles.warningSectionIconContainer}>
                    <PWRoundIcon
                        icon={icon}
                        size='md'
                        variant='secondary'
                    />
                    <PWView style={styles.warningMessageContainer}>
                        <PWText style={styles.warningMessage}>
                            {t(messageKey, {
                                address: truncateAlgorandAddress(
                                    warning.targetAddress,
                                    LONG_ADDRESS_FORMAT,
                                ),
                            })}
                        </PWText>
                        {!isClose && (
                            <PWText variant='h4'>
                                {t('transactions.warning.rekey_warning_bold')}
                            </PWText>
                        )}
                        <PWText
                            variant='caption'
                            style={styles.senderText}
                        >
                            {t('transactions.warning.from_account', {
                                address: truncateAlgorandAddress(
                                    warning.senderAddress,
                                    LONG_ADDRESS_FORMAT,
                                ),
                            })}
                        </PWText>
                    </PWView>
                </PWView>
            </PWView>
        </>
    )
}

export const SigningWarnings = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { aggregatedWarnings } = useTransactionSigningContext()
    const { isOpen, open, close } = useModalState()

    if (aggregatedWarnings.length === 0) {
        return null
    }

    const warningCount = aggregatedWarnings.length

    return (
        <>
            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />
            <PWView style={styles.warningContainer}>
                <PanelButton
                    onPress={open}
                    title={t('transactions.warning.title')}
                    titleWeight='h4'
                    description={t('transactions.warning.title_cta', {
                        count: warningCount,
                    })}
                    leftIcon='info'
                    rightIcon='chevron-right'
                    variant='error'
                />

                <PWBottomSheet isVisible={isOpen}>
                    <PWView style={styles.sheetContainer}>
                        <PWToolbar
                            left={
                                <PWIcon
                                    name='cross'
                                    variant='secondary'
                                    onPress={close}
                                />
                            }
                            center={
                                <PWText variant='h4'>
                                    {t('transactions.warning.title', {
                                        count: warningCount,
                                    })}
                                </PWText>
                            }
                        />

                        {aggregatedWarnings.map((warning, index) => (
                            <WarningItem
                                key={`${warning.type}-${warning.senderAddress}-${warning.targetAddress}`}
                                warning={warning}
                                showDivider={index > 0}
                            />
                        ))}
                    </PWView>
                </PWBottomSheet>
            </PWView>
        </>
    )
}
