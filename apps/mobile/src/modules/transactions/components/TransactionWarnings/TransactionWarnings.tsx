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

import { useCallback } from 'react'
import { PWDivider, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useTheme } from '@rneui/themed'
import { useTransactionWarnings } from './useTransactionWarnings'
import { TransactionWarningsContent } from './TransactionWarningsContent'

export type TransactionWarningsProps = {
    transaction: PeraDisplayableTransaction
}

export const TransactionWarnings = ({
    transaction,
}: TransactionWarningsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()
    const { request: requestBottomSheet } = useBottomSheet()

    const { warningCount } = useTransactionWarnings(transaction)

    const handleOpen = useCallback(() => {
        void requestBottomSheet({
            contents: <TransactionWarningsContent transaction={transaction} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, transaction])

    if (warningCount === 0) {
        return null
    }

    return (
        <>
            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />
            <PWView style={styles.warningContainer}>
                <PanelButton
                    onPress={handleOpen}
                    title={t('transactions.warning.title')}
                    titleWeight='h4'
                    description={t('transactions.warning.title_cta', {
                        count: warningCount,
                    })}
                    leftIcon='info'
                    rightIcon='chevron-right'
                    variant='error'
                    style={styles.panelButton}
                />
            </PWView>
        </>
    )
}
