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
import { safeAreaLayout } from '@layouts/index'
import { BackupInfoScreen } from '../screens/BackupInfoScreen'
import { BackupReminderWriteDownScreen } from '../screens/BackupReminderWriteDownScreen'
import { BackupReminderMnemonicScreen } from '../screens/BackupReminderMnemonicScreen'
import { BackupVerificationScreen } from '../screens/BackupVerificationScreen'
import { BackupReminderSuccessScreen } from '../screens/BackupReminderSuccessScreen'
import type { BackupStackParamList } from './types'

export type { BackupStackParamList } from './types'

const Stack = createAppStackNavigator<BackupStackParamList>()

export const BackupStackNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                title: '',
                ...SCREEN_ANIMATION_CONFIG,
            }}
            layout={safeAreaLayout}
        >
            <Stack.Screen
                name='BackupInfo'
                component={BackupInfoScreen}
            />
            <Stack.Screen
                name='BackupWriteDown'
                component={BackupReminderWriteDownScreen}
            />
            <Stack.Screen
                name='BackupMnemonic'
                component={BackupReminderMnemonicScreen}
            />
            <Stack.Screen
                name='BackupVerification'
                component={BackupVerificationScreen}
            />
            <Stack.Screen
                name='BackupSuccess'
                options={{ headerShown: false }}
                component={BackupReminderSuccessScreen}
            />
        </Stack.Navigator>
    )
}
