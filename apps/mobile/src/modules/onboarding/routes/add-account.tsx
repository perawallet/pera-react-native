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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { AddAccountScreen } from '@modules/onboarding/screens/AddAccountScreen'
import { WatchInfoScreen } from '@modules/onboarding/screens/WatchInfoScreen'
import { WatchAccountScreen } from '@modules/onboarding/screens/WatchAccountScreen'
import { SelectHDWalletScreen } from '@modules/onboarding/screens/SelectHDWalletScreen'
import { screenListeners } from '@routes/listeners'
import { fullScreenLayout } from '@layouts/index'

import type { AddAccountStackParamList } from './types'
import {
    renderImportFlowScreens,
    withAccountErrorBoundary,
    type ImportFlowStack,
} from './shared-screens'

const AddAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(AddAccountScreen)
const SelectHDWalletScreenWithErrorBoundary =
    withAccountErrorBoundary(SelectHDWalletScreen)
const WatchInfoScreenWithErrorBoundary =
    withAccountErrorBoundary(WatchInfoScreen)
const WatchAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(WatchAccountScreen)

const AddAccountStack = createAppStackNavigator<AddAccountStackParamList>()

export const AddAccountStackNavigator = () => {
    return (
        <AddAccountStack.Navigator
            initialRouteName='AddAccountHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
        >
            <AddAccountStack.Screen
                name='AddAccountHome'
                options={{ headerShown: false }}
                layout={fullScreenLayout}
                component={AddAccountScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='SelectHDWallet'
                options={{ title: '' }}
                component={SelectHDWalletScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='WatchInfo'
                options={{ title: '' }}
                component={WatchInfoScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='WatchAccount'
                options={{ title: '' }}
                component={WatchAccountScreenWithErrorBoundary}
            />
            {renderImportFlowScreens(
                AddAccountStack as unknown as ImportFlowStack,
            )}
        </AddAccountStack.Navigator>
    )
}
