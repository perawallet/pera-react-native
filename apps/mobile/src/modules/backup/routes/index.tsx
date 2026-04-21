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
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { safeAreaLayout } from '@layouts/index'
import { BackupFlowProvider } from '../context'
import { BackupInfoScreen } from '../screens/BackupInfoScreen'
import { BackupWriteDownScreen } from '../screens/BackupWriteDownScreen'
import { BackupMnemonicScreen } from '../screens/BackupMnemonicScreen'
import { BackupVerificationScreen } from '../screens/BackupVerificationScreen'
import { BackupSuccessScreen } from '../screens/BackupSuccessScreen'
import type { BackupStackParamList } from './types'

export type { BackupStackParamList } from './types'

const Stack = createNativeStackNavigator<BackupStackParamList>()

export const BackupStackNavigator = () => {
    return (
        <BackupFlowProvider>
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
                    component={BackupWriteDownScreen}
                />
                <Stack.Screen
                    name='BackupMnemonic'
                    component={BackupMnemonicScreen}
                />
                <Stack.Screen
                    name='BackupVerification'
                    component={BackupVerificationScreen}
                />
                <Stack.Screen
                    name='BackupSuccess'
                    options={{ headerShown: false }}
                    component={BackupSuccessScreen}
                />
            </Stack.Navigator>
        </BackupFlowProvider>
    )
}
