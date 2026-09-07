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

import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { NavigationHeader } from '@components/NavigationHeader'
import { RekeyToQuantumConfirmScreen } from '../../screens/rekey-to-quantum/RekeyToQuantumConfirmScreen'
import { RekeyToQuantumIntroScreen } from '../../screens/rekey-to-quantum/RekeyToQuantumIntroScreen'
import { RekeyToQuantumSelectTargetScreen } from '../../screens/rekey-to-quantum/RekeyToQuantumSelectTargetScreen'
import { RekeyToQuantumSuccessScreen } from '../../screens/rekey-to-quantum/RekeyToQuantumSuccessScreen'

import type { RekeyToQuantumStackParamList } from './types'

const Stack = createNativeStackNavigator<RekeyToQuantumStackParamList>()

export const RekeyToQuantumStackNavigator = () => {
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
                name='RekeyToQuantumIntro'
                component={RekeyToQuantumIntroScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToQuantumSelectTarget'
                component={RekeyToQuantumSelectTargetScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToQuantumConfirm'
                component={RekeyToQuantumConfirmScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToQuantumSuccess'
                component={RekeyToQuantumSuccessScreen}
                options={{ headerShown: false, gestureEnabled: false }}
            />
        </Stack.Navigator>
    )
}
