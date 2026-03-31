/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    createStackNavigator,
    type StackHeaderProps,
} from '@react-navigation/stack'

import { PWIcon } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import { BidaliIntroScreen } from '../screens/BidaliIntroScreen'
import { BidaliAccountSelectionScreen } from '../screens/BidaliAccountSelectionScreen'
import { BidaliWebViewScreen } from '../screens/BidaliWebViewScreen'
import { useBidali } from '../hooks/useBidali'
import { useStyles } from './styles'
import type { BidaliStackParamList } from './types'

const Stack = createStackNavigator<BidaliStackParamList>()

export const BidaliRoutes = () => {
    const { onClose } = useBidali()
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName='BidaliIntro'
            detachInactiveScreens={false}
            screenOptions={{
                headerShown: true,
                header: (props: StackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                cardStyle: [styles.screenContent, styles.screen],
                detachPreviousScreen: false,
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
                options={{
                    headerShown: false,
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onClose}
                        />
                    ),
                }}
            />
        </Stack.Navigator>
    )
}
