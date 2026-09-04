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
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { screenListeners } from '@routes/listeners'
import { CreateMultisigScreen } from '../screens/CreateMultisigScreen'
import { EditParticipantScreen } from '../screens/EditParticipantScreen'
import { SetThresholdScreen } from '../screens/SetThresholdScreen'
import { NameMultisigScreen } from '../screens/NameMultisigScreen'
import { ImportSharedAccountScreen } from '../screens/ImportSharedAccountScreen'
import type { MultisigStackParamList } from './types'

export type { MultisigStackParamList } from './types'

const MultisigStack = createNativeStackNavigator<MultisigStackParamList>()

export const MultisigStackNavigator = () => {
    return (
        <MultisigStack.Navigator
            initialRouteName='CreateMultisig'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
        >
            <MultisigStack.Screen
                name='CreateMultisig'
                options={{ title: '' }}
                component={CreateMultisigScreen}
            />
            <MultisigStack.Screen
                name='EditParticipant'
                options={{ title: '' }}
                component={EditParticipantScreen}
            />
            <MultisigStack.Screen
                name='SetThreshold'
                options={{ title: '' }}
                component={SetThresholdScreen}
            />
            <MultisigStack.Screen
                name='NameMultisig'
                options={{ title: '' }}
                component={NameMultisigScreen}
            />
            <MultisigStack.Screen
                name='ImportSharedAccount'
                options={{ title: '' }}
                component={ImportSharedAccountScreen}
            />
        </MultisigStack.Navigator>
    )
}
