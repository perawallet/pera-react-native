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
import { PWScreen } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import { useLanguage } from '@hooks/useLanguage'
import { FavoriteDappList } from '../../components/FavoriteDappList'
import { FolderHeaderTitle } from './FolderHeaderTitle'
import { useDiscoverFolderScreen } from './useDiscoverFolderScreen'

export const DiscoverFolderScreen = () => {
    const { t } = useLanguage()
    // The screen's own navigation object: it owns this screen's header options.
    const navigation = useNavigation()
    const screen = useDiscoverFolderScreen()
    const name = screen.folder?.name ?? ''
    const count = screen.folder?.count ?? 0

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <FolderHeaderTitle
                    name={name}
                    count={count}
                />
            ),
        })
    }, [navigation, name, count])

    return (
        <PWScreen
            scroll='never'
            testID='discover_folder_screen'
        >
            <FavoriteDappList
                dapps={screen.dapps}
                isVerified={screen.isVerified}
                onPress={screen.openDapp}
                onUnfavorite={screen.unfavorite}
                emptyText={t('discover.folders.empty')}
                testIDPrefix='discover_folder_dapp'
            />
        </PWScreen>
    )
}
