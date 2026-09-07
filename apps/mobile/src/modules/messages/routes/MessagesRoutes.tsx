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

import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { screenListeners } from '@routes/listeners'
import { fullScreenLayout, safeAreaLayout } from '@layouts/index'

import { AssetTransferRequestsScreen } from '@modules/transactions/screens/claim-assets/AssetTransferRequestsScreen/AssetTransferRequestsScreen'
import { AssetClaimDetailScreen } from '@modules/transactions/screens/claim-assets/AssetClaimDetailScreen/AssetClaimDetailScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import { ClaimProcessingScreen } from '@modules/transactions/screens/claim-assets/ClaimProcessingScreen/ClaimProcessingScreen'
import type { MessagesStackParamList } from './types'
import { MessagesScreen } from '../screens/MessagesScreen'
import { MultisigInvitationNameScreen } from '../screens/MultisigInvitationNameScreen'

const MessagesStack = createAppStackNavigator<MessagesStackParamList>()

export const MessagesStackNavigator = () => {
    return (
        <MessagesStack.Navigator
            initialRouteName='MessagesHome'
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
            <MessagesStack.Screen
                name='MessagesHome'
                options={{ title: 'screens.messages' }}
                component={MessagesScreen}
            />
            <MessagesStack.Screen
                name='AssetTransferRequests'
                component={AssetTransferRequestsScreen}
                options={{
                    title: 'messages.claim.asset_transfer_requests_title',
                }}
            />

            <MessagesStack.Screen
                name='AssetClaimDetail'
                component={AssetClaimDetailScreen}
                options={{
                    title: 'messages.claim.asset_transfer_request_title',
                }}
            />

            <MessagesStack.Screen
                name='ClaimProcessing'
                component={ClaimProcessingScreen}
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />

            <MessagesStack.Screen
                name='ClaimSuccess'
                component={TransactionSuccessScreen}
                layout={safeAreaLayout}
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />

            <MessagesStack.Screen
                name='MultisigInvitationName'
                component={MultisigInvitationNameScreen}
                options={{ title: 'multisig.invitation.name.screen_title' }}
            />
        </MessagesStack.Navigator>
    )
}
