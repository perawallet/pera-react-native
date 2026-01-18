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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { screenListeners } from '@routes/listeners'
import { PinEntryScreen } from '@modules/security/screens/PinEntryScreen'
import { fullScreenLayout } from '@layouts/index'
import type { PinEntryMode } from '@modules/security/components/PinEntry'

export type SecurityStackParamsList = {
    PinEntry: {
        mode: PinEntryMode
        onSuccess?: () => void
    }
}

const SecurityStack = createNativeStackNavigator<SecurityStackParamsList>()

export const SecurityStackNavigator = () => {
    return (
        <SecurityStack.Navigator
            initialRouteName='PinEntry'
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
            <SecurityStack.Screen
                name='PinEntry'
                options={{
                    title: 'screens.pin_entry',
                }}
                component={PinEntryScreen}
            />
        </SecurityStack.Navigator>
    )
}
