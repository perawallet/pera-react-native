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

import { type TransactionWarning } from '@perawallet/wallet-core-signing'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { PWDivider, PWRoundIcon, PWText, PWView } from '@components/core'
import {
    formatNumber,
    LONG_ADDRESS_LENGTH,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'

type WarningItemProps = {
    warning: TransactionWarning
    showDivider: boolean
    isGroup: boolean
}

type AddressWarning = Extract<
    TransactionWarning,
    { type: 'close' | 'rekey' | 'asset-freeze' }
>

const getWarningConfig = (type: AddressWarning['type'], isGroup: boolean) => {
    switch (type) {
        case 'close': {
            return {
                icon: 'trash' as const,
                messageKey: isGroup
                    ? 'transactions.warning.close_group_warning'
                    : 'transactions.warning.close_warning',
                boldKey: null,
            }
        }
        case 'rekey': {
            return {
                icon: 'rekey' as const,
                messageKey: isGroup
                    ? 'transactions.warning.rekey_group_warning'
                    : 'transactions.warning.rekey_warning',
                boldKey: 'transactions.warning.rekey_warning_bold',
            }
        }
        case 'asset-freeze': {
            return {
                icon: 'snowflake' as const,
                messageKey: isGroup
                    ? 'transactions.warning.asset_freeze_group_warning'
                    : 'transactions.warning.asset_freeze_warning',
                boldKey: 'transactions.warning.asset_freeze_warning_bold',
            }
        }
    }
}

export const WarningItem = ({
    warning,
    showDivider,
    isGroup,
}: WarningItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const divider = showDivider && (
        <PWDivider
            style={styles.divider}
            color={theme.colors.layerGray}
        />
    )

    if (warning.type === 'high-fee') {
        return (
            <>
                {divider}
                <PWView style={styles.warningSection}>
                    <PWView style={styles.warningSectionIconContainer}>
                        <PWRoundIcon
                            icon='info'
                            size='md'
                            variant='secondary'
                        />
                        <PWView style={styles.warningMessageContainer}>
                            <PWText style={styles.warningMessage}>
                                {t('transactions.warning.high_fee_warning', {
                                    fee: formatNumber(
                                        microAlgosToAlgos(warning.totalFee),
                                        ALGO_ASSET.decimals,
                                    ),
                                })}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            </>
        )
    }

    const { icon, messageKey, boldKey } = getWarningConfig(
        warning.type,
        isGroup,
    )

    return (
        <>
            {divider}
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
                                    LONG_ADDRESS_LENGTH,
                                ),
                            })}
                        </PWText>
                        {boldKey && <PWText variant='h4'>{t(boldKey)}</PWText>}
                        <PWText
                            variant='caption'
                            style={styles.senderText}
                        >
                            {t('transactions.warning.from_account', {
                                address: truncateAlgorandAddress(
                                    warning.senderAddress,
                                    LONG_ADDRESS_LENGTH,
                                ),
                            })}
                        </PWText>
                    </PWView>
                </PWView>
            </PWView>
        </>
    )
}
