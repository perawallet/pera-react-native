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
import type { CardWalletHistoryEntry } from '@perawallet/wallet-core-chain-algorand/card'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { TransactionDateHeader } from '@modules/transactions'
import { useLanguage } from '@hooks/useLanguage'
import { CardWalletHistoryItem } from '../../components/CardWalletHistoryItem'
import type { CardTransactionSection } from '../../utils/cardTransactions'
import { useCardWalletBalanceScreen } from './useCardWalletBalanceScreen'
import { useStyles } from './styles'

export const CardWalletBalanceScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation()
    const {
        kind,
        copy,
        hero,
        balanceDisplay,
        currencyDisplay,
        isLoading,
        isError,
        hasBalance,
        canWithdraw,
        handleWithdraw,
        refetch,
        historySections,
        hasHistory,
        isFetchingHistory,
        handleLoadMore,
    } = useCardWalletBalanceScreen()

    useLayoutEffect(() => {
        navigation.setOptions({ title: copy.navigationTitle })
    }, [navigation, copy.navigationTitle])

    const renderItem = useCallback(
        ({ item }: { item: CardWalletHistoryEntry }) => (
            <CardWalletHistoryItem entry={item} />
        ),
        [],
    )

    const renderSectionHeader = useCallback(
        ({
            section,
        }: {
            section: CardTransactionSection<CardWalletHistoryEntry>
        }) => <TransactionDateHeader title={section.title} />,
        [],
    )

    // Baanx sends no row id; a timestamp alone can repeat within a page.
    const keyExtractor = useCallback(
        (item: CardWalletHistoryEntry, index: number) =>
            `${item.dateTime}-${index}`,
        [],
    )

    const renderFooter = useCallback(() => {
        if (!isFetchingHistory) return null
        return (
            <PWView style={styles.loadingFooter}>
                <ActivityIndicator size='small' />
            </PWView>
        )
    }, [isFetchingHistory, styles.loadingFooter])

    const header = (
        <PWView style={styles.content}>
            <PWView style={styles.heroSection}>
                <PWView
                    style={styles.artwork}
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility='no-hide-descendants'
                >
                    <PWImage
                        source={hero}
                        style={styles.hero}
                        resizeMode='contain'
                        showLoadingIndicator={false}
                    />
                </PWView>
                <PWView style={styles.balanceSection}>
                    <PWText
                        variant='footnoteMedium'
                        style={styles.secondaryText}
                    >
                        {t(copy.balanceLabel)}
                    </PWText>
                    {isError ? (
                        <PWView style={styles.status}>
                            <PWText
                                variant='body'
                                style={styles.centeredText}
                            >
                                {t('peraCard.credits.error_body')}
                            </PWText>
                            <PWButton
                                variant='link'
                                title={t('peraCard.credits.retry')}
                                onPress={refetch}
                                testID='card-wallet-balance-retry'
                            />
                        </PWView>
                    ) : isLoading || balanceDisplay === null ? (
                        <PWSkeleton style={styles.balanceSkeleton} />
                    ) : (
                        <>
                            <PWText
                                variant='h1'
                                style={styles.balance}
                                testID='card-wallet-balance-amount'
                            >
                                {balanceDisplay}{' '}
                                <PWText
                                    variant='h3'
                                    style={styles.secondaryText}
                                >
                                    {currencyDisplay}
                                </PWText>
                            </PWText>
                            <PWView style={styles.status}>
                                {!hasBalance && (
                                    <PWText
                                        variant='h3'
                                        style={styles.centeredText}
                                    >
                                        {t(copy.emptyTitle)}
                                    </PWText>
                                )}
                                <PWText
                                    variant='body'
                                    style={styles.centeredText}
                                >
                                    {!hasBalance
                                        ? t(copy.emptyBody)
                                        : canWithdraw
                                          ? t(copy.body)
                                          : t(copy.notWithdrawableBody)}
                                </PWText>
                            </PWView>
                        </>
                    )}
                </PWView>
            </PWView>

            <PWView style={styles.guide}>
                <PWText variant='h4'>{t(copy.howTitle)}</PWText>
                <PWView style={styles.guideRow}>
                    <PWView style={styles.iconContainer}>
                        <PWIcon name='card' />
                    </PWView>
                    <PWView style={styles.guideText}>
                        <PWText variant='bodySemibold'>
                            {t(copy.howFirstTitle)}
                        </PWText>
                        <PWText
                            variant='bodyCompact'
                            style={styles.secondaryText}
                        >
                            {t(copy.howFirstBody)}
                        </PWText>
                    </PWView>
                </PWView>
                <PWView style={styles.guideRow}>
                    <PWView style={styles.iconContainer}>
                        <PWIcon name='wallet' />
                    </PWView>
                    <PWView style={styles.guideText}>
                        <PWText variant='bodySemibold'>
                            {t(copy.howSecondTitle)}
                        </PWText>
                        <PWText
                            variant='bodyCompact'
                            style={styles.secondaryText}
                        >
                            {t(copy.howSecondBody)}
                        </PWText>
                    </PWView>
                </PWView>
            </PWView>

            {hasHistory && (
                <PWText
                    variant='h4'
                    style={styles.historyTitle}
                    testID='card-wallet-balance-history'
                >
                    {t('peraCard.credits.history_title')}
                </PWText>
            )}
        </PWView>
    )

    return (
        <PWScreen
            scroll='never'
            testID={`card-wallet-balance-${kind}`}
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.credits.claim_button')}
                    onPress={handleWithdraw}
                    isDisabled={!canWithdraw}
                    testID='card-wallet-balance-claim-cta'
                />
            }
        >
            <SectionList
                sections={historySections}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={header}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
            />
        </PWScreen>
    )
}
