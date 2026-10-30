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

import { PWFlatList, PWIcon, PWScreen, PWView } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useStyles } from './styles'
import { useSearchScreenList } from './useSearchScreenList'
import { useSearchScreen } from './useSearchScreen'

const SKELETON_ROW_COUNT = 5

export const SearchScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
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
        chainId,
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

    const listKey = `${scopes.join(',')}:${value}`

    const { listRef, renderItem, keyExtractor } = useSearchScreenList({
        onAccountPress,
        onContactPress,
        onAssetPress,
        onExpandSection,
        chainId,
        value,
        scopes,
    })


    const hasQuery = value.length > 0
    const showSkeleton = hasQuery && isLoading && !hasResults
    const showNoResults = hasQuery && !isLoading && !hasResults

    const renderListEmpty = () => {
        if (showNoResults) {
            return (
                <EmptyView
                    icon='magnifying-glass'
                    title={t('search.no_results_title')}
                    body={t('search.no_results_body')}
                />
            )
        }
        if (showSkeleton) {
            return (
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
            )
        }
        return (
            <EmptyView
                icon='magnifying-glass'
                title={t('search.empty_prompt_title')}
                body={t('search.empty_prompt_body')}
            />
        )
    }

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
                ListEmptyComponent={renderListEmpty()}
            />
        </PWScreen>
    )
}
