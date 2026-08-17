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
    type IconName,
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
import {
    type AddressWarningType,
    useTransactionWarnings,
} from './useTransactionWarnings'

export type TransactionWarningsContentProps = {
    transaction: PeraDisplayableTransaction
}

type WarningDisplay = {
    type: AddressWarningType
    icon: IconName
    copyKey: string
    boldKey?: string
}

// Array order is the sheet's render order — a transaction can carry several of
// these at once (a close plus a rekey, say), so it needs to be deterministic.
const WARNING_DISPLAYS: WarningDisplay[] = [
    {
        type: 'close-account',
        icon: 'trash',
        copyKey: 'transactions.warning.close_account_warning',
    },
    {
        type: 'close-asset',
        icon: 'unlink',
        copyKey: 'transactions.warning.close_asset_warning',
    },
    {
        type: 'rekey',
        icon: 'rekey',
        copyKey: 'transactions.warning.rekey_warning',
        boldKey: 'transactions.warning.rekey_warning_bold',
    },
    {
        type: 'asset-freeze',
        icon: 'snowflake',
        copyKey: 'transactions.warning.asset_freeze_warning',
        boldKey: 'transactions.warning.asset_freeze_warning_bold',
    },
]

export const TransactionWarningsContent = ({
    transaction,
}: TransactionWarningsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()

    const { warningCount, warningsByType } = useTransactionWarnings(transaction)

    const rows = WARNING_DISPLAYS.flatMap(display =>
        warningsByType[display.type].map(warning => ({ display, warning })),
    )

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
            {rows.map(({ display, warning }, index) => (
                <PWView
                    key={`${display.type}-${warning.senderAddress}-${warning.targetAddress}`}
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
                            icon={display.icon}
                            size='md'
                            variant='secondary'
                        />
                        <PWView style={styles.warningMessageContainer}>
                            <PWText style={styles.warningMessage}>
                                {t(display.copyKey, {
                                    address: truncateAlgorandAddress(
                                        warning.targetAddress,
                                        LONG_ADDRESS_LENGTH,
                                    ),
                                })}
                            </PWText>
                            {display.boldKey && (
                                <PWText variant='h4'>
                                    {t(display.boldKey)}
                                </PWText>
                            )}
                        </PWView>
                    </PWView>
                </PWView>
            ))}
        </PWSheetLayout>
    )
}
