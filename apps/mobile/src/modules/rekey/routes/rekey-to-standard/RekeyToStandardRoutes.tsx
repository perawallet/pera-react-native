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
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { NavigationHeader } from '@components/NavigationHeader'
import { RekeyToStandardConfirmScreen } from '../../screens/rekey-to-standard/RekeyToStandardConfirmScreen'
import { RekeyToStandardIntroScreen } from '../../screens/rekey-to-standard/RekeyToStandardIntroScreen'
import { RekeyToStandardSelectTargetScreen } from '../../screens/rekey-to-standard/RekeyToStandardSelectTargetScreen'
import { RekeyToStandardSuccessScreen } from '../../screens/rekey-to-standard/RekeyToStandardSuccessScreen'

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
                component={RekeyToStandardIntroScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToStandardSelectTarget'
                component={RekeyToStandardSelectTargetScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToStandardConfirm'
                component={RekeyToStandardConfirmScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToStandardSuccess'
                component={RekeyToStandardSuccessScreen}
                options={{ headerShown: false, gestureEnabled: false }}
            />
        </Stack.Navigator>
    )
}
