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

import { Fragment } from 'react'
import FavoritesIcon from '@assets/icons/discover/favorites.svg'
import FolderAddIcon from '@assets/icons/discover/folder-add.svg'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { DiscoverSectionHeader } from '../DiscoverSectionHeader'
import { FolderRow, type FolderRowProps } from '../FolderRow'
import { RowDivider } from '../RowDivider'
import { useFavoritesSection } from './useFavoritesSection'
import { useStyles } from './styles'

/** The Discover home's Favorites: All favorites, the newest folders, See all. */
export const FavoritesSection = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const section = useFavoritesSection()

    const rows: (FolderRowProps & { key: string })[] = [
        ...(section.favoriteCount > 0
            ? [
                  {
                      key: 'all',
                      name: t('discover.favorites.all_favorites'),
                      count: section.favoriteCount,
                      icon: 'star' as const,
                      onPress: section.openAllFavorites,
                      testID: 'discover_home_all_favorites',
                  },
              ]
            : []),
        ...section.folders.map(folder => ({
            key: folder.id,
            name: folder.name,
            count: folder.count,
            icon: 'folder' as const,
            onPress: () => section.openFolder(folder.id),
            testID: `discover_home_folder_${folder.id}`,
        })),
    ]

    return (
        <PWView
            style={styles.section}
            testID='discover_home_favorites'
        >
            <DiscoverSectionHeader
                title={t('discover.favorites.title')}
                icon={<FavoritesIcon />}
                action={{
                    label: t('discover.favorites.new_folder'),
                    icon: <FolderAddIcon />,
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
            {rows.length > 0 ? (
                <PWView>
                    {rows.map(({ key, ...row }, index) => (
                        <Fragment key={key}>
                            {index > 0 ? <RowDivider /> : null}
                            <FolderRow {...row} />
                        </Fragment>
                    ))}
                </PWView>
            ) : null}
            {section.hasMore ? (
                <PWTouchableOpacity
                    style={styles.seeAll}
                    onPress={section.openAllFolders}
                    testID='discover_home_folders_see_all'
                >
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                    >
                        {t('discover.favorites.see_all')}
                    </PWText>
                    <PWIcon
                        name='chevron-down'
                        size='sm'
                    />
                </PWTouchableOpacity>
            ) : null}
        </PWView>
    )
}
