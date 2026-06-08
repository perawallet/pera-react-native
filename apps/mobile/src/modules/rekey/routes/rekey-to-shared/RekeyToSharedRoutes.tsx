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
import { RekeyToSharedConfirmScreen } from '../../screens/rekey-to-shared/RekeyToSharedConfirmScreen'
import { RekeyToSharedIntroScreen } from '../../screens/rekey-to-shared/RekeyToSharedIntroScreen'
import { RekeyToSharedSelectTargetScreen } from '../../screens/rekey-to-shared/RekeyToSharedSelectTargetScreen'
import { RekeyToSharedSuccessScreen } from '../../screens/rekey-to-shared/RekeyToSharedSuccessScreen'

import type { RekeyToSharedStackParamList } from './types'

const Stack = createNativeStackNavigator<RekeyToSharedStackParamList>()

export const RekeyToSharedStackNavigator = () => {
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
                name='RekeyToSharedIntro'
                component={RekeyToSharedIntroScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToSharedSelectTarget'
                component={RekeyToSharedSelectTargetScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToSharedConfirm'
                component={RekeyToSharedConfirmScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToSharedSuccess'
                component={RekeyToSharedSuccessScreen}
                options={{ headerShown: false, gestureEnabled: false }}
            />
        </Stack.Navigator>
    )
}
