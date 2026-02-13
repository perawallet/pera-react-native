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

import { PWIcon, PWView } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import { useSendFunds } from '@modules/transactions/hooks'
import { SendFundsAssetSelection } from '../SendFundsAssetSelection/SendFundsAssetSelection'
import { SendFundsInputView } from '../SendFundsInputView/SendFundsInputView'
import { SendFundsSelectDestination } from '../SendFundsSelectDestination/SendFundsSelectDestination'
import { SendFundsTransactionConfirmation } from '../SendFundsTransactionConfirmation/SendFundsTransactionConfirmation'
import { useStyles } from './styles'
import type { SendFundsStackParamList } from './types'

type SendFundsRoutesProps = {
    onFinished: () => void
}

const Stack = createStackNavigator<SendFundsStackParamList>()

export const SendFundsRoutes = ({ onFinished }: SendFundsRoutesProps) => {
    const { canSelectAsset } = useSendFunds()
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
                cardStyle: styles.screenContent,
                detachPreviousScreen: false,
            }}
        >
            <Stack.Screen
                name='AssetSelection'
                options={{
                    title: 'send_funds.asset_selection.title',
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onFinished}
                        />
                    ),
                }}
            >
                {({ navigation }) => (
                    <PWView style={styles.tabItem}>
                        <SendFundsAssetSelection
                            onSelected={() =>
                                navigation.navigate('InputAmount')
                            }
                        />
                    </PWView>
                )}
            </Stack.Screen>

            <Stack.Screen
                name='InputAmount'
                options={{
                    headerShown: false,
                }}
            >
                {({ navigation }) => (
                    <PWView style={styles.tabItem}>
                        <SendFundsInputView
                            onNext={() =>
                                navigation.navigate('SelectDestination')
                            }
                            onBack={() => {
                                if (canSelectAsset) {
                                    navigation.navigate('AssetSelection')
                                } else {
                                    onFinished()
                                }
                            }}
                        />
                    </PWView>
                )}
            </Stack.Screen>

            <Stack.Screen
                name='SelectDestination'
                options={{
                    headerShown: false,
                }}
            >
                {({ navigation }) => (
                    <PWView style={styles.tabItem}>
                        <SendFundsSelectDestination
                            onNext={() =>
                                navigation.navigate('ConfirmTransaction')
                            }
                            onBack={() => navigation.navigate('InputAmount')}
                        />
                    </PWView>
                )}
            </Stack.Screen>

            <Stack.Screen
                name='ConfirmTransaction'
                options={{
                    title: 'send_funds.confirmation.title',
                }}
            >
                {() => (
                    <PWView style={styles.tabItem}>
                        <SendFundsTransactionConfirmation onNext={onFinished} />
                    </PWView>
                )}
            </Stack.Screen>
        </Stack.Navigator>
    )
}
