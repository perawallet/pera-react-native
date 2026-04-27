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

import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { NavigationHeader } from '@components/NavigationHeader'
import { RekeyConfirmScreen } from '../screens/RekeyConfirmScreen'
import { RekeyIntroScreen } from '../screens/RekeyIntroScreen'
import { RekeySelectTargetScreen } from '../screens/RekeySelectTargetScreen'
import { RekeySuccessScreen } from '../screens/RekeySuccessScreen'

import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import type { RekeyToStandardStackParamList } from './types'

const Stack = createNativeStackNavigator<RekeyToStandardStackParamList>()

export const RekeyToStandardStackNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
            }}
        >
            <Stack.Screen
                name='RekeyToStandardIntro'
                component={RekeyIntroScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToStandardSelectTarget'
                component={RekeySelectTargetScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToStandardConfirm'
                component={RekeyConfirmScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToStandardSuccess'
                component={RekeySuccessScreen}
                options={{ headerShown: false, gestureEnabled: false }}
            />
        </Stack.Navigator>
    )
}
