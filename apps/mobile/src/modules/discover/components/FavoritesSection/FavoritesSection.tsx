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

import FavoritesIcon from '@assets/icons/discover/favorites.svg'
import { PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import type { DiscoverFavorite } from '../../types'
import { DiscoverSectionHeader } from '../DiscoverSectionHeader'
import { FavoriteTile } from '../FavoriteTile'
import { FavoritesFilterBar } from '../FavoritesFilterBar'
import { SuggestedDappTile } from '../SuggestedDappTile'
import { useFavoritesSection } from './useFavoritesSection'
import { useStyles } from './styles'

const GRID_COLUMNS = 3

const rowsOf = (dapps: DiscoverFavorite[]): DiscoverFavorite[][] => {
    const rows: DiscoverFavorite[][] = []
    for (let i = 0; i < dapps.length; i += GRID_COLUMNS) {
        rows.push(dapps.slice(i, i + GRID_COLUMNS))
    }
    return rows
}

/** The Discover home's Favorites: the filters and a grid of up to six, See all. */
export const FavoritesSection = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const section = useFavoritesSection()

    const renderEmpty = () => {
        if (section.suggestions.length === 0) {
            return (
                <EmptyView
                    title={t('discover.favorites.empty_title')}
                    body={t('discover.favorites.empty_body')}
                    style={styles.empty}
                    testID='discover_home_favorites_empty'
                />
            )
        }
        return (
            // Something to add right away, instead of a bare "no favorites".
            <PWView
                style={styles.suggestions}
                testID='discover_home_favorites_empty'
            >
                <PWText
                    variant='body'
                    style={styles.suggestionsBody}
                >
                    {t('discover.favorites.suggestions.body')}
                </PWText>
                <PWView style={styles.gridRow}>
                    {section.suggestions.map(dapp => (
                        <SuggestedDappTile
                            key={dapp.url}
                            dapp={dapp}
                            onPress={() => section.openDapp(dapp)}
                            onAdd={() => section.addSuggestion(dapp)}
                            testID={`discover_home_suggestion_${dapp.url}`}
                        />
                    ))}
                    {Array.from(
                        {
                            length: GRID_COLUMNS - section.suggestions.length,
                        },
                        (_, i) => (
                            <PWView
                                key={`filler-${i}`}
                                style={styles.filler}
                            />
                        ),
                    )}
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.section}
            testID='discover_home_favorites'
        >
            <DiscoverSectionHeader
                title={t('discover.favorites.title')}
                icon={<FavoritesIcon />}
                action={
                    section.isEmpty
                        ? undefined
                        : {
                              label: t('discover.favorites.see_all'),
                              onPress: section.openAll,
                              testID: 'discover_home_favorites_see_all',
                          }
                }
                testID='discover_home_favorites_header'
            />
            {section.isEmpty ? (
                renderEmpty()
            ) : (
                <PWView style={styles.body}>
                    <FavoritesFilterBar testID='discover_home_favorites_filters' />
                    <PWView style={styles.grid}>
                        {rowsOf(section.dapps).map(row => (
                            <PWView
                                key={row[0]?.url}
                                style={styles.gridRow}
                            >
                                {row.map(dapp => (
                                    <FavoriteTile
                                        key={dapp.url}
                                        dapp={dapp}
                                        onPress={() => section.openDapp(dapp)}
                                        onLongPress={section.openRearrange}
                                        testID={`discover_home_favorite_${dapp.url}`}
                                    />
                                ))}
                                {Array.from(
                                    { length: GRID_COLUMNS - row.length },
                                    (_, i) => (
                                        <PWView
                                            // Fillers keep a short last row aligned to the grid.
                                            key={`filler-${i}`}
                                            style={styles.filler}
                                        />
                                    ),
                                )}
                            </PWView>
                        ))}
                    </PWView>
                </PWView>
            )}
        </PWView>
    )
}
