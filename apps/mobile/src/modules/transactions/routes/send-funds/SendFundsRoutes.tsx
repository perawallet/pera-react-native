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
    createStackNavigator,
    type StackHeaderProps,
} from '@react-navigation/stack'

import { PWIcon } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import { useSendFunds } from '@modules/transactions/hooks'
import { AssetSelectionScreen } from '../../screens/send-funds/AssetSelectionScreen/AssetSelectionScreen'
import { InputScreen } from '../../screens/send-funds/InputScreen/InputScreen'
import { SelectDestinationScreen } from '../../screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'
import { TransactionConfirmationScreen } from '../../screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { ExpressSendScreen } from '../../screens/send-funds/ExpressSendScreen'
import { ARC59SendSummaryScreen } from '../../screens/send-funds/ARC59SendSummaryScreen'
import { InsufficientBalanceScreen } from '../../screens/send-funds/InsufficientBalanceScreen'
import { TransactionProcessingScreen } from '../../screens/send-funds/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '../../screens/send-funds/TransactionSuccessScreen'
import { useStyles } from './styles'
import type { SendFundsStackParamList } from './types'

const Stack = createStackNavigator<SendFundsStackParamList>()

export const SendFundsRoutes = () => {
    const { canSelectAsset, onFinished } = useSendFunds()
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName={canSelectAsset ? 'AssetSelection' : 'InputAmount'}
            detachInactiveScreens={false}
            screenOptions={{
                headerShown: true,
                header: (props: StackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                cardStyle: [styles.screenContent, styles.tabItem],
                detachPreviousScreen: false,
            }}
        >
            <Stack.Screen
                name='AssetSelection'
                component={AssetSelectionScreen}
                options={{
                    title: 'send_funds.asset_selection.title',
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onFinished}
                        />
                    ),
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
                name='ExpressSend'
                component={ExpressSendScreen}
                options={{
                    title: 'send_funds.express_send.title',
                }}
            />

            <Stack.Screen
                name='ARC59SendSummary'
                component={ARC59SendSummaryScreen}
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
