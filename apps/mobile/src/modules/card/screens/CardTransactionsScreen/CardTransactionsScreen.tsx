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

import { useCallback, useLayoutEffect } from 'react'
import { ActivityIndicator, SectionList } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
    PWButton,
    PWIcon,
    PWScreen,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { TransactionDateHeader } from '@modules/transactions/components/TransactionDateHeader'
import { useLanguage } from '@hooks/useLanguage'
import type { CardTransaction } from '@perawallet/wallet-core-card'
import { CardTransactionListItem } from '../../components/CardTransactionListItem'
import type { CardTransactionSection } from '../../utils/cardTransactions'
import { useCardTransactions } from './useCardTransactions'
import { useStyles } from './styles'

export const CardTransactionsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation()
    const {
        sections,
        isLoading,
        isFetchingNextPage,
        isError,
        isEmpty,
        handleLoadMore,
        handleRetry,
        onExport,
        onPressTransaction,
    } = useCardTransactions()

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <PWTouchableOpacity
                    onPress={onExport}
                    testID='card_transactions_export'
                    accessibilityLabel={t(
                        'peraCard.transactions.export_accessibility_label',
                    )}
                >
                    <PWIcon name='download' />
                </PWTouchableOpacity>
            ),
        })
    }, [navigation, onExport, t])

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
                <ActivityIndicator size='small' />
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

    return (
        <PWScreen
            scroll='never'
            testID='card_transactions_screen'
        >
            <SectionList
                sections={sections}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={
                    isEmpty || isLoading ? renderEmptyComponent() : null
                }
                ListFooterComponent={renderFooter}
            />
        </PWScreen>
    )
}
