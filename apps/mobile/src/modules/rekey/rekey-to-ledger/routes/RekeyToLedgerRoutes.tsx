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
import { RekeyToLedgerConfirmScreen } from '../screens/RekeyToLedgerConfirmScreen'
import { RekeyToLedgerIntroScreen } from '../screens/RekeyToLedgerIntroScreen'
import { RekeyToLedgerSelectTargetScreen } from '../screens/RekeyToLedgerSelectTargetScreen'
import { RekeyToLedgerSuccessScreen } from '../screens/RekeyToLedgerSuccessScreen'

import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import type { RekeyToLedgerStackParamList } from './types'

const Stack = createNativeStackNavigator<RekeyToLedgerStackParamList>()

export const RekeyToLedgerStackNavigator = () => {
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
                name='RekeyToLedgerIntro'
                component={RekeyToLedgerIntroScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToLedgerSelectTarget'
                component={RekeyToLedgerSelectTargetScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToLedgerConfirm'
                component={RekeyToLedgerConfirmScreen}
                options={{ title: '' }}
            />
            <Stack.Screen
                name='RekeyToLedgerSuccess'
                component={RekeyToLedgerSuccessScreen}
                options={{ headerShown: false, gestureEnabled: false }}
            />
        </Stack.Navigator>
    )
}
