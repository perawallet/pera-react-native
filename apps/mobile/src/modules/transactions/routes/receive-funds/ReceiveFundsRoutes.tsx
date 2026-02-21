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
import { useReceiveFunds } from '@modules/transactions/hooks'
import { AccountSelectionScreen } from '../../screens/receive-funds/AccountSelectionScreen'
import { QRViewScreen } from '../../screens/receive-funds/QRViewScreen'
import { useStyles } from './styles'
import type { ReceiveFundsStackParamList } from './types'

const Stack = createStackNavigator<ReceiveFundsStackParamList>()

export const ReceiveFundsRoutes = () => {
    const { canSelectAccount, onFinished } = useReceiveFunds()
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName={canSelectAccount ? 'AccountSelection' : 'QRView'}
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
                name='AccountSelection'
                component={AccountSelectionScreen}
                options={{
                    title: 'receive_funds.account_selection.title',
                    headerLeft: () => (
                        <PWIcon
                            name='cross'
                            onPress={onFinished}
                        />
                    ),
                }}
            />

            <Stack.Screen
                name='QRView'
                component={QRViewScreen}
            />
        </Stack.Navigator>
    )
}
