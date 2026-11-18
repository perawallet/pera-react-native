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

import { PWScreen } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { FavoriteDappList } from '../../components/FavoriteDappList'
import { useDiscoverAllFavoritesScreen } from './useDiscoverAllFavoritesScreen'

export const DiscoverAllFavoritesScreen = () => {
    const { t } = useLanguage()
    const screen = useDiscoverAllFavoritesScreen()

    return (
        <PWScreen
            scroll='never'
            testID='discover_all_favorites_screen'
        >
            <FavoriteDappList
                dapps={screen.dapps}
                isVerified={screen.isVerified}
                onPress={screen.openDapp}
                onUnfavorite={screen.unfavorite}
                emptyText={t('discover.favorites.empty_body')}
                testIDPrefix='discover_all_favorites_dapp'
            />
        </PWScreen>
    )
}
