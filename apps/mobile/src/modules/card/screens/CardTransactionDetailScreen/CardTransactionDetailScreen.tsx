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

import { PWButton, PWScreen, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { CardTransactionDetailHeader } from './CardTransactionDetailHeader'
import { CardTransactionDetailTabs } from './CardTransactionDetailTabs'
import { useCardTransactionDetailScreen } from './useCardTransactionDetailScreen'
import { useStyles } from './styles'

export const CardTransactionDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        transaction,
        isLoading,
        isError,
        handleRetry,
        onReportTransaction,
    } = useCardTransactionDetailScreen()

    const renderContent = () => {
        if (isLoading) {
            return (
                <LoadingView
                    variant='circle'
                    size='lg'
                    style={styles.loadingContainer}
                />
            )
        }
        if (!transaction) {
            // A failed fetch is not "your transaction is gone" — keep the
            // two verdicts distinct (same copy as the list screen's error).
            return (
                <EmptyView
                    title={t(
                        isError
                            ? 'peraCard.transactions.error_title'
                            : 'peraCard.transactions.detail_not_found_title',
                    )}
                    body={t(
                        isError
                            ? 'peraCard.transactions.error_body'
                            : 'peraCard.transactions.detail_not_found_body',
                    )}
                    button={
                        <PWButton
                            variant='secondary'
                            title={t('peraCard.transactions.retry')}
                            onPress={handleRetry}
                            testID='card_transaction_detail_retry'
                        />
                    }
                    style={styles.emptyView}
                />
            )
        }
        return (
            <>
                <CardTransactionDetailHeader transaction={transaction} />
                <PWView style={styles.tabs}>
                    <CardTransactionDetailTabs transaction={transaction} />
                </PWView>
            </>
        )
    }

    return (
        <PWScreen
            scroll='never'
            testID='card_transaction_detail_screen'
            footer={
                transaction ? (
                    <PWButton
                        variant='secondary'
                        icon='flag'
                        title={t('peraCard.transactions.detail_report')}
                        onPress={onReportTransaction}
                        testID='card_transaction_detail_report'
                    />
                ) : undefined
            }
        >
            <PWView style={styles.container}>{renderContent()}</PWView>
        </PWScreen>
    )
}
