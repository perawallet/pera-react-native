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
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { PWFlatList, PWView } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { AccountAssetItemView } from '../AssetItem/AccountAssetItemView'
import { useAccountAssetSelectionList } from './useAccountAssetSelectionList'
import { useStyles } from './styles'

export type AccountAssetSelectionListProps = {
    onAssetSelected: (asset: AssetWithAccountBalance) => void
    isVisible?: boolean
    inBottomSheet?: boolean
    hasPadding?: boolean
    excludeAssetId?: string
    searchPlaceholder: string
    emptyResultTitle: string
    emptyResultBody: string
}

export const AccountAssetSelectionList = ({
    onAssetSelected,
    isVisible,
    inBottomSheet,
    hasPadding = true,
    excludeAssetId,
    searchPlaceholder,
    emptyResultTitle,
    emptyResultBody,
}: AccountAssetSelectionListProps) => {
    const styles = useStyles({ hasPadding })
    const {
        filteredBalanceData,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
    } = useAccountAssetSelectionList({ isVisible, excludeAssetId })

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => (
            <AccountAssetItemView
                onPress={() => onAssetSelected(item)}
                style={styles.item}
                accountBalance={item}
            />
        ),
        [onAssetSelected, styles],
    )

    return (
        <>
            <PWView style={styles.searchContainer}>
                <SearchInput
                    placeholder={searchPlaceholder}
                    value={searchFilter}
                    onChangeText={setSearchFilter}
                />
            </PWView>
            <PWFlatList
                contentContainerStyle={styles.listContent}
                data={filteredBalanceData}
                renderItem={renderItem}
                keyExtractor={item => item.assetId}
                keyboardDismissMode='on-drag'
                inBottomSheet={inBottomSheet}
                ListEmptyComponent={
                    debouncedSearchFilter ? (
                        <EmptyView
                            title={emptyResultTitle}
                            body={emptyResultBody}
                        />
                    ) : (
                        <LoadingView
                            variant='skeleton'
                            count={3}
                        />
                    )
                }
            />
        </>
    )
}
