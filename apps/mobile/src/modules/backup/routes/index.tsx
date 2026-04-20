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
import { Text } from 'react-native'

import { BackupFlowProvider } from '../context'
import type { BackupStackParamList } from './types'

export type { BackupStackParamList } from './types'

const Stack = createNativeStackNavigator<BackupStackParamList>()

// Placeholder component; real screens are wired in Task 19.
const Placeholder = () => <Text>Backup flow — placeholder</Text>

export const BackupStackNavigator = () => {
    return (
        <BackupFlowProvider>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* Screens registered in Task 19 */}
                <Stack.Screen
                    name='BackupInstructions'
                    component={Placeholder}
                />
            </Stack.Navigator>
        </BackupFlowProvider>
    )
}
