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

import { PWButton, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    SectionList,
} from 'react-native'
import { useStyles } from './styles'
import { useAccountHistory, type TransactionSection } from './useAccountHistory'
import { TransactionListItem } from './TransactionListItem'
import { TransactionDateHeader } from './TransactionDateHeader'

const TAB_AND_HEADER_HEIGHT = 100

export type AccountHistoryProps = {
    scrollEnabled?: boolean
}

export const AccountHistory = ({ scrollEnabled }: AccountHistoryProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        sections,
        isLoading,
        isFetchingNextPage,
        isEmpty,
        handleLoadMore,
        handleExportCsv,
        isExportingCsv,
    } = useAccountHistory()

    const renderItem = ({ item }: { item: TransactionHistoryItem }) => (
        <TransactionListItem transaction={item} />
    )

    const renderSectionHeader = ({
        section,
    }: {
        section: TransactionSection
    }) => <TransactionDateHeader title={section.title} />

    const keyExtractor = (item: TransactionHistoryItem) => item.id

    const renderFooter = () => {
        if (isFetchingNextPage) {
            return (
                <PWView style={styles.loadingFooter}>
                    <ActivityIndicator size='small' />
                </PWView>
            )
        }
        return <PWView style={styles.footer} />
    }

    const renderEmptyComponent = () => {
        if (isLoading) {
            return (
                <PWView style={styles.loadingContainer}>
                    <ActivityIndicator size='large' />
                </PWView>
            )
        }

        return (
            <EmptyView
                title={t('asset_details.transaction_list.empty_title')}
                body={t('asset_details.transaction_list.empty_body')}
            />
        )
    }

    return (
        <KeyboardAvoidingView
            keyboardVerticalOffset={TAB_AND_HEADER_HEIGHT}
            enabled
            behavior='padding'
            style={styles.keyboardAvoidingViewContainer}
        >
            <PWTouchableOpacity
                style={styles.keyboardAvoidingViewContainer}
                activeOpacity={1}
            >
                <SectionList
                    sections={sections}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    keyExtractor={keyExtractor}
                    scrollEnabled={scrollEnabled}
                    contentContainerStyle={styles.rootContainer}
                    stickySectionHeadersEnabled={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListHeaderComponent={
                        <PWView style={styles.headerContainer}>
                            <PWView style={styles.titleBar}>
                                <PWText
                                    style={styles.title}
                                    variant='h4'
                                >
                                    {t('asset_details.transaction_list.title')}
                                </PWText>
                                <PWView style={styles.titleBarButtonContainer}>
                                    <PWButton
                                        icon='sliders'
                                        title={t(
                                            'asset_details.transaction_list.filter',
                                        )}
                                        variant='helper'
                                        style={styles.transparentButton}
                                        paddingStyle='dense'
                                    />
                                    <PWButton
                                        icon='document-download'
                                        title={t(
                                            'asset_details.transaction_list.csv',
                                        )}
                                        variant='helper'
                                        paddingStyle='dense'
                                        onPress={handleExportCsv}
                                        isLoading={isExportingCsv}
                                    />
                                </PWView>
                            </PWView>
                        </PWView>
                    }
                    ListEmptyComponent={
                        !isLoading && isEmpty ? renderEmptyComponent() : null
                    }
                    ListFooterComponent={renderFooter}
                />
                {isLoading && !sections.length && (
                    <PWView style={styles.loadingOverlay}>
                        <ActivityIndicator size='large' />
                    </PWView>
                )}
            </PWTouchableOpacity>
        </KeyboardAvoidingView>
    )
}
