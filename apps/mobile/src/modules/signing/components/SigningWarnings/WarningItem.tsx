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

import { type TransactionWarning } from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { PWDivider, PWRoundIcon, PWText, PWView } from '@components/core'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { LONG_ADDRESS_FORMAT } from '@constants/ui'

type WarningItemProps = {
    warning: TransactionWarning
    showDivider: boolean
    isGroup: boolean
}

const getWarningConfig = (
    type: TransactionWarning['type'],
    isGroup: boolean,
) => {
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

    const { icon, messageKey, boldKey } = getWarningConfig(
        warning.type,
        isGroup,
    )

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
                        {boldKey && <PWText variant='h4'>{t(boldKey)}</PWText>}
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
