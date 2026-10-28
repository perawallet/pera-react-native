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

// Web replacement for SendFundsRoutes, same fix as ReceiveFundsRoutes.web.tsx:
// a nested `@react-navigation/stack` navigator needs a `flex: 1` chain to
// resolve a real pixel height, and inside PWBottomSheet.web's Modal one link
// collapses to `height: 0` — CardContent's `overflow: hidden` then clips
// everything below it.
//
// native-stack's web screens are plain Views with no measure-then-clip step, so
// swapping just this navigator sidesteps the collapse.
import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'

import { PWIcon } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import { useSendFunds } from '@modules/transactions/hooks'
import { AddContactScreen } from '@modules/contacts/routes'
import { AssetSelectionScreen } from '../../screens/send-funds/AssetSelectionScreen/AssetSelectionScreen'
import { SendChainSelectionScreen } from '../../screens/send-funds/SendChainSelectionScreen'
import { InputScreen } from '../../screens/send-funds/InputScreen/InputScreen'
import { SelectDestinationScreen } from '../../screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'
import { TransactionConfirmationScreen } from '../../screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { ExpressSendScreen } from '../../screens/send-funds/ExpressSendScreen'
import { AssetInboxSendSummaryScreen } from '../../screens/send-funds/AssetInboxSendSummaryScreen'
import { InsufficientBalanceScreen } from '../../screens/send-funds/InsufficientBalanceScreen'
import { TransactionProcessingScreen } from '../../screens/send-funds/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '../../screens/send-funds/TransactionSuccessScreen'
import { useStyles } from './styles'
import type { SendFundsStackParamList } from './types'
import { useSendFundsRoutes } from './useSendFundsRoutes'

const Stack = createNativeStackNavigator<SendFundsStackParamList>()

export const SendFundsRoutes = () => {
    const { onFinished } = useSendFunds()
    const { initialRouteName } = useSendFundsRoutes()
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                        paddingStyle='dense'
                    />
                ),
                contentStyle: [styles.screenContent, styles.tabItem],
            }}
        >
            <Stack.Screen
                name='ChainSelection'
                component={SendChainSelectionScreen}
                options={{
                    title: 'chain_selection.title',
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onFinished}
                        />
                    ),
                }}
            />

            <Stack.Screen
                name='AssetSelection'
                component={AssetSelectionScreen}
                options={{
                    title: 'send_funds.asset_selection.title',
                    // Reached from Choose Network, the default back arrow returns there.
                    ...(initialRouteName === 'AssetSelection'
                        ? {
                              headerLeft: () => (
                                  <PWIcon
                                      name='cross'
                                      onPress={onFinished}
                                  />
                              ),
                          }
                        : {}),
                }}
            />

            <Stack.Screen
                name='InputAmount'
                component={InputScreen}
            />

            <Stack.Screen
                name='SelectDestination'
                component={SelectDestinationScreen}
            />

            <Stack.Screen
                name='ConfirmTransaction'
                component={TransactionConfirmationScreen}
                options={{
                    title: 'send_funds.confirmation.title',
                }}
            />

            <Stack.Screen
                name='AddContact'
                options={{
                    title: 'screens.add_contact',
                }}
            >
                {() => <AddContactScreen submitPlacement='header' />}
            </Stack.Screen>

            <Stack.Screen
                name='ExpressSend'
                component={ExpressSendScreen}
                options={{
                    title: 'send_funds.express_send.title',
                }}
            />

            <Stack.Screen
                name='AssetInboxSendSummary'
                component={AssetInboxSendSummaryScreen}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name='InsufficientBalance'
                component={InsufficientBalanceScreen}
                options={{
                    title: 'send_funds.insufficient_balance.title',
                }}
            />

            <Stack.Screen
                name='TransactionProcessing'
                component={TransactionProcessingScreen}
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />

            <Stack.Screen
                name='TransactionSuccess'
                component={TransactionSuccessScreen}
                options={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
            />
        </Stack.Navigator>
    )
}
