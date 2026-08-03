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

// Web replacement for BidaliRoutes, same fix as ReceiveFundsRoutes.web.tsx and
// SendFundsRoutes.web.tsx: a nested `@react-navigation/stack` navigator needs a
// `flex: 1` chain to resolve a real pixel height, and inside
// PWBottomSheet.web's Modal one link collapses to `height: 0` — CardContent's
// `overflow: hidden` then clips everything and the sheet paints blank.
//
// native-stack's web screens are plain Views with no measure-then-clip step, so
// swapping just this navigator sidesteps the collapse without patching
// react-navigation/stack internals.
import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'

import { NavigationHeader } from '@components/NavigationHeader'
import { BidaliIntroScreen } from '../screens/BidaliIntroScreen'
import { BidaliAccountSelectionScreen } from '../screens/BidaliAccountSelectionScreen'
import { BidaliWebViewScreen } from '../screens/BidaliWebViewScreen'
import { useStyles } from './styles'
import type { BidaliStackParamList } from './types'

const Stack = createNativeStackNavigator<BidaliStackParamList>()

export const BidaliRoutes = () => {
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName='BidaliIntro'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                contentStyle: [styles.screenContent, styles.screen],
            }}
        >
            <Stack.Screen
                name='BidaliIntro'
                component={BidaliIntroScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name='BidaliAccountSelection'
                component={BidaliAccountSelectionScreen}
                options={{
                    title: 'giftCard.intro.navigation_title',
                }}
            />

            <Stack.Screen
                name='BidaliWebView'
                component={BidaliWebViewScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    )
}
