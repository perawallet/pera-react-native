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
    useCallback,
    useLayoutEffect,
    useMemo,
    type ReactElement,
} from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    StatementFormat,
    useCardTransactionsQuery,
    useExportCardStatementMutation,
    type CardTransaction,
} from '@perawallet/wallet-core-card'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { trackEvent, CardEvent } from '@analytics'
import { shareFile } from '@utils/shareFile'
import { useCardScope } from '../../hooks/useCardScope'
import { useCardErrorToast } from '../../hooks'
import type { PeraCardAccountStackParamList } from '../../routes/types'
import {
    PWButton,
    PWIcon,
    PWLoadingIndicator,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { TransactionDateHeader } from '@modules/transactions'
import { useLanguage } from '@hooks/useLanguage'
import { CardTransactionListItem } from '../../components/CardTransactionListItem'
import { useStyles } from './styles'
import {
    groupCardTransactionsByMonth,
    type CardTransactionSection,
} from '../../utils/cardTransactions'

const PDF_MIME_TYPE = 'application/pdf'

// Dated so the share sheet's suggested name tells statements apart.
const buildStatementFilename = (): string =>
    `pera-card-statement-${new Date().toISOString().slice(0, 10)}.pdf`

type UseCardTransactionsResult = {
    sections: CardTransactionSection[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    isEmpty: boolean
    handleLoadMore: () => void
    handleRetry: () => void
    onExport: () => void
    isExporting: boolean
    onPressTransaction: (id: string) => void
    renderItem: (params: { item: CardTransaction }) => ReactElement
    renderSectionHeader: (params: {
        section: CardTransactionSection
    }) => ReactElement
    keyExtractor: (item: CardTransaction) => string
    renderFooter: () => ReactElement
    renderEmptyComponent: () => ReactElement
}

export const useCardTransactions = (): UseCardTransactionsResult => {
    const scope = useCardScope()
    const navigation =
        useNavigation<
            NativeStackNavigationProp<PeraCardAccountStackParamList>
        >()
    const {
        transactions,
        isLoading,
        isFetchingNextPage,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useCardTransactionsQuery(scope)
    const { mutateAsync: exportStatement, isPending: isExporting } =
        useExportCardStatementMutation(scope)
    const showExportError = useCardErrorToast({
        titleKey: i18nKey('peraCard.transactions.export_error_title'),
        bodyKey: i18nKey('peraCard.transactions.export_error_body'),
        shouldUseBackendMessage: false,
    })

    const sections = useMemo(
        () => groupCardTransactionsByMonth(transactions),
        [transactions],
    )

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const handleRetry = useCallback(() => {
        void refetch()
    }, [refetch])

    const onExport = useCallback(() => {
        if (isExporting) return
        trackEvent(CardEvent.TransactionsExport)
        const run = async () => {
            try {
                const statement = await exportStatement({
                    format: StatementFormat.Pdf,
                })
                await shareFile(buildStatementFilename(), statement.bytes, {
                    mimeType: PDF_MIME_TYPE,
                })
            } catch (error) {
                void showExportError(error)
            }
        }
        void run()
    }, [isExporting, exportStatement, showExportError])

    const onPressTransaction = useCallback(
        (id: string) => {
            trackEvent(CardEvent.TransactionsSelect)
            navigation.navigate('CardTransactionDetail', { id })
        },
        [navigation],
    )

    const { t } = useLanguage()
    const styles = useStyles()

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <PWTouchableOpacity
                    onPress={onExport}
                    disabled={isExporting}
                    testID='card_transactions_export'
                    accessibilityLabel={t(
                        'peraCard.transactions.export_accessibility_label',
                    )}
                >
                    <PWIcon name='download' />
                </PWTouchableOpacity>
            ),
        })
    }, [navigation, onExport, isExporting, t])

    const renderItem = useCallback(
        ({ item }: { item: CardTransaction }) => (
            <CardTransactionListItem
                transaction={item}
                onPress={onPressTransaction}
            />
        ),
        [onPressTransaction],
    )

    const renderSectionHeader = useCallback(
        ({ section }: { section: CardTransactionSection }) => (
            <TransactionDateHeader title={section.title} />
        ),
        [],
    )

    const keyExtractor = useCallback((item: CardTransaction) => item.id, [])

    const renderFooter = useCallback(() => {
        if (!isFetchingNextPage) return null
        return (
            <PWView style={styles.loadingFooter}>
                <PWLoadingIndicator size='sm' />
            </PWView>
        )
    }, [isFetchingNextPage, styles.loadingFooter])

    const renderEmptyComponent = useCallback(() => {
        if (isLoading) {
            return (
                <LoadingView
                    variant='circle'
                    size='lg'
                    style={styles.loadingContainer}
                />
            )
        }
        if (isError) {
            return (
                <EmptyView
                    title={t('peraCard.transactions.error_title')}
                    body={t('peraCard.transactions.error_body')}
                    button={
                        <PWButton
                            variant='secondary'
                            title={t('peraCard.transactions.retry')}
                            onPress={handleRetry}
                            testID='card_transactions_retry'
                        />
                    }
                    style={styles.emptyView}
                />
            )
        }
        return (
            <EmptyView
                body={t('peraCard.account.transactions_empty')}
                style={styles.emptyView}
                testID='card_transactions_empty'
            />
        )
    }, [
        isLoading,
        isError,
        handleRetry,
        styles.loadingContainer,
        styles.emptyView,
        t,
    ])

    return {
        sections,
        isLoading,
        isFetchingNextPage,
        isError,
        isEmpty: !isLoading && transactions.length === 0,
        handleLoadMore,
        handleRetry,
        onExport,
        isExporting,
        onPressTransaction,
        renderItem,
        renderSectionHeader,
        keyExtractor,
        renderFooter,
        renderEmptyComponent,
    }
}
