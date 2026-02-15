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
import { SendFundsAssetSelection } from '../SendFundsAssetSelection/SendFundsAssetSelection'
import { SendFundsInputView } from '../SendFundsInputView/SendFundsInputView'
import { SendFundsSelectDestination } from '../SendFundsSelectDestination/SendFundsSelectDestination'
import { SendFundsTransactionConfirmation } from '../SendFundsTransactionConfirmation/SendFundsTransactionConfirmation'
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
                component={SendFundsAssetSelection}
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
                component={SendFundsInputView}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name='SelectDestination'
                component={SendFundsSelectDestination}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name='ConfirmTransaction'
                component={SendFundsTransactionConfirmation}
                options={{
                    title: 'send_funds.confirmation.title',
                }}
            />
        </Stack.Navigator>
    )
}
