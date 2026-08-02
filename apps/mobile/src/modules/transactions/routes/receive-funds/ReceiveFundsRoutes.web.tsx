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

// Web replacement for ReceiveFundsRoutes: a nested `@react-navigation/stack`
// navigator needs a `flex: 1` chain to resolve a real pixel height, and inside
// PWBottomSheet.web's Modal one link (CardStack's `MaybeScreenContainer`, whose
// only child is absolutely positioned) collapses to `height: 0`. CardContent's
// `overflow: hidden` then clips everything and the sheet paints blank.
//
// native-stack's web screens are plain Views with no measure-then-clip step, so
// swapping just this navigator sidesteps the collapse.
import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'

import { PWIcon } from '@components/core'
import { NavigationHeader } from '@components/NavigationHeader'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { AccountSelectionScreen } from '../../screens/receive-funds/AccountSelectionScreen'
import { QRViewScreen } from '../../screens/receive-funds/QRViewScreen'
import { useStyles } from './styles'
import type { ReceiveFundsStackParamList } from './types'

const Stack = createNativeStackNavigator<ReceiveFundsStackParamList>()

export const ReceiveFundsRoutes = () => {
    const { canSelectAccount, onFinished } = useReceiveFunds()
    const styles = useStyles()

    return (
        <Stack.Navigator
            initialRouteName={canSelectAccount ? 'AccountSelection' : 'QRView'}
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                contentStyle: [styles.screenContent, styles.tabItem],
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
