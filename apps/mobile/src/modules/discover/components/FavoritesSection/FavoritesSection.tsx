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

import { PWButton, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { DiscoverSectionHeader } from '../DiscoverSectionHeader'
import { FolderRow } from './FolderRow'
import { useFavoritesSection } from './useFavoritesSection'
import { useStyles } from './styles'

/** The Discover home's Favorites: All favorites, the newest folders, See all. */
export const FavoritesSection = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const section = useFavoritesSection()

    return (
        <PWView
            style={styles.section}
            testID='discover_home_favorites'
        >
            <DiscoverSectionHeader
                title={t('discover.favorites.title')}
                action={{
                    label: t('discover.favorites.new_folder'),
                    onPress: () => {
                        void section.openNewFolder()
                    },
                    testID: 'discover_home_new_folder',
                }}
                testID='discover_home_favorites_header'
            />
            {section.isEmpty ? (
                <EmptyView
                    title={t('discover.favorites.empty_title')}
                    body={t('discover.favorites.empty_body')}
                    style={styles.empty}
                    testID='discover_home_favorites_empty'
                />
            ) : null}
            {section.favoriteCount > 0 ? (
                <FolderRow
                    name={t('discover.favorites.all_favorites')}
                    count={section.favoriteCount}
                    icon='star'
                    onPress={section.openAllFavorites}
                    testID='discover_home_all_favorites'
                />
            ) : null}
            {section.folders.map(folder => (
                <FolderRow
                    key={folder.id}
                    name={folder.name}
                    count={folder.count}
                    icon='folder'
                    onPress={() => section.openFolder(folder.id)}
                    testID={`discover_home_folder_${folder.id}`}
                />
            ))}
            {section.hasMore ? (
                <PWButton
                    variant='secondary'
                    title={t('discover.favorites.see_all')}
                    iconRight='chevron-down'
                    onPress={section.openAllFolders}
                    testID='discover_home_folders_see_all'
                />
            ) : null}
        </PWView>
    )
}
