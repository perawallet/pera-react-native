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

import { useLayoutEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    PWFlatList,
    PWIcon,
    PWScreen,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { SearchInput } from '@components/SearchInput'
import { useLanguage } from '@hooks/useLanguage'
import { DappRow } from '../../components/DappRow'
import { FavoritesFilterBar } from '../../components/FavoritesFilterBar'
import { useDiscoverAllFavoritesScreen } from './useDiscoverAllFavoritesScreen'
import { useStyles } from './styles'

/** Every favorite, with search and the category and sort chips (Figma "Favorites"). */
export const DiscoverAllFavoritesScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const screen = useDiscoverAllFavoritesScreen()
    // The screen's own navigation object: it owns this screen's header options.
    const navigation = useNavigation()
    const { openRearrange } = screen

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <PWTouchableOpacity
                    onPress={openRearrange}
                    testID='discover_all_favorites_rearrange'
                    accessibilityLabel={t(
                        'discover.favorites.rearrange.open_label',
                    )}
                >
                    <PWIcon name='sliders' />
                </PWTouchableOpacity>
            ),
        })
    }, [navigation, openRearrange, t])

    return (
        <PWScreen
            scroll='never'
            testID='discover_all_favorites_screen'
        >
            <PWView style={styles.controls}>
                <SearchInput
                    value={screen.query}
                    onChangeText={screen.setQuery}
                    placeholder={t('discover.favorites.search_placeholder')}
                    testID='discover_all_favorites_search'
                />
                <FavoritesFilterBar testID='discover_all_favorites_filters' />
            </PWView>
            <PWFlatList
                // FlashList v2 re-anchors on the first visible row on every
                // data change. This list only reorders (Rearrange, sort) or
                // narrows (search, category) and never prepends, so anchoring
                // only drags the viewport.
                maintainVisibleContentPosition={{ disabled: true }}
                data={screen.dapps}
                keyExtractor={dapp => dapp.url}
                ListEmptyComponent={
                    <EmptyView
                        body={
                            screen.isFilteredOut
                                ? t('discover.search.no_results')
                                : t('discover.favorites.empty_body')
                        }
                        style={styles.empty}
                        testID='discover_all_favorites_dapp_empty'
                    />
                }
                renderItem={({ item }) => (
                    <DappRow
                        dapp={item}
                        subtitle={screen.subtitleOf(item)}
                        isFavorite
                        isVerified={screen.isVerified(item.url)}
                        showChains={false}
                        hasSiteIcon
                        onPress={() => screen.openDapp(item)}
                        onToggleFavorite={() => screen.removeFavorite(item)}
                        testID={`discover_all_favorites_dapp_${item.url}`}
                    />
                )}
            />
        </PWScreen>
    )
}
