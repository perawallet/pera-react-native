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

import { PWFlatList, PWScreen } from '@components/core'
import { FolderRow } from '../../components/FavoritesSection/FolderRow'
import { useDiscoverAllFoldersScreen } from './useDiscoverAllFoldersScreen'
import { useStyles } from './styles'

export const DiscoverAllFoldersScreen = () => {
    const styles = useStyles()
    const screen = useDiscoverAllFoldersScreen()

    return (
        <PWScreen
            scroll='never'
            testID='discover_all_folders_screen'
        >
            <PWFlatList
                data={screen.folders}
                keyExtractor={folder => folder.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <FolderRow
                        name={item.name}
                        count={item.count}
                        icon='folder'
                        onPress={() => screen.openFolder(item.id)}
                        testID={`discover_all_folders_${item.id}`}
                    />
                )}
            />
        </PWScreen>
    )
}
