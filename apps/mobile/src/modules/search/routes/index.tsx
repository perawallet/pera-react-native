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

import { type NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { fullScreenLayout } from '@layouts/index'
import { screenListeners } from '@routes/listeners'
import { SearchScreen } from '@modules/search/screens/SearchScreen'

import { type SearchStackParamsList } from './types'

const SearchStack = createAppStackNavigator<SearchStackParamsList>()

export const SearchStackNavigator = () => {
    return (
        <SearchStack.Navigator
            initialRouteName='SearchScreen'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={fullScreenLayout}
        >
            <SearchStack.Screen
                name='SearchScreen'
                options={{ title: 'search.screen_title' }}
                component={SearchScreen}
            />
        </SearchStack.Navigator>
    )
}
