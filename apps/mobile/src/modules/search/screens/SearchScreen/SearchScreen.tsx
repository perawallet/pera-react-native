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

import { useCallback, useEffect, useRef } from 'react'
import {
    PWFlatList,
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
    type PWFlatListRef,
} from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetTitle } from '@modules/assets/components/AssetTitle'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useStyles } from './styles'
import { useSearchScreen, type SearchRow } from './useSearchScreen'

const SKELETON_ROW_COUNT = 5

export const SearchScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const listRef = useRef<PWFlatListRef>(null)
    const {
        value,
        setValue,
        rows,
        hasResults,
        isLoading,
        scopes,
        onAccountPress,
        onContactPress,
        onAssetPress,
        onExpandSection,
        openFilterSheet,
    } = useSearchScreen()

    useNavigationHeader({
        right: (
            <PWIcon
                name='sliders'
                onPress={openFilterSheet}
                testID='search_filter_button'
                style={styles.searchIcon}
            />
        ),
    })

    useEffect(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false })
    }, [value, scopes])

    const listKey = `${scopes.join(',')}:${value}`

    const renderItem = useCallback(
        ({ item }: { item: SearchRow }) => {
            switch (item.type) {
                case 'section_header': {
                    return (
                        <PWView style={styles.sectionHeader}>
                            <PWText variant='h4'>
                                {t(`search.sections.${item.kind}`)}
                            </PWText>
                        </PWView>
                    )
                }
                case 'account': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onAccountPress(item.account)}
                            testID={`search_result_account_${item.account.address}`}
                        >
                            <AccountDisplay
                                account={item.account}
                                showChevron={false}
                                style={styles.rowContainer}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'contact': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onContactPress(item.contact)}
                            testID={`search_result_contact_${item.contact.address}`}
                        >
                            <AddressDisplay
                                address={item.contact.address}
                                showCopy={false}
                                style={styles.rowContainer}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'asset': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => void onAssetPress(item.asset)}
                            style={styles.assetRow}
                            testID={`search_result_asset_${item.asset.assetId}`}
                        >
                            <AssetTitle
                                asset={item.asset}
                                showId
                                nameVariant='body'
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'show_more': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onExpandSection(item.kind)}
                            style={styles.showMore}
                            testID={`search_show_more_${item.kind}`}
                        >
                            <PWText
                                variant='caption'
                                style={styles.showMoreText}
                            >
                                {t('search.show_more', {
                                    count: item.hiddenCount,
                                })}
                            </PWText>
                            <PWIcon
                                name='chevron-right'
                                variant='link'
                                size='sm'
                            />
                        </PWTouchableOpacity>
                    )
                }
            }
        },
        [
            onAccountPress,
            onContactPress,
            onAssetPress,
            onExpandSection,
            styles,
            t,
        ],
    )

    const keyExtractor = useCallback((row: SearchRow) => row.key, [])

    const hasQuery = value.length > 0
    const showSkeleton = hasQuery && isLoading && !hasResults
    const showNoResults = hasQuery && !isLoading && !hasResults

    return (
        <PWScreen scroll='never'>
            <SearchInput
                value={value}
                onChangeText={setValue}
                placeholder={t('search.placeholder')}
                containerStyle={styles.searchContainer}
                inputContainerStyle={styles.searchField}
                testID='search_input'
                autoFocus
            />
            <PWFlatList
                key={listKey}
                ref={listRef}
                data={rows}
                renderItem={renderItem}
                // Mixed rows incl. section headers / show-more — no blanket divider.
                ItemSeparatorComponent={null}
                keyExtractor={keyExtractor}
                style={styles.list}
                contentContainerStyle={styles.contentContainer}
                ListEmptyComponent={
                    showNoResults ? (
                        <EmptyView
                            icon='magnifying-glass'
                            title={t('search.no_results_title')}
                            body={t('search.no_results_body')}
                        />
                    ) : showSkeleton ? (
                        <PWView
                            testID='search_loading_skeleton'
                            style={styles.skeletonContainer}
                        >
                            <LoadingView
                                variant='skeleton'
                                count={SKELETON_ROW_COUNT}
                                size='sm'
                            />
                        </PWView>
                    ) : (
                        <EmptyView
                            icon='magnifying-glass'
                            title={t('search.empty_prompt_title')}
                            body={t('search.empty_prompt_body')}
                        />
                    )
                }
            />
        </PWScreen>
    )
}
