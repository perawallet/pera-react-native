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

import { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import { createStackNavigator } from '@react-navigation/stack'
import { useMemo } from 'react'
import { SigningStackParamList } from './types'
import {
    SingleTransactionScreen,
    TransactionDetailsScreen,
    TransactionListScreen,
    GroupDetailScreen,
} from '@modules/signing/screens'
import { useStyles } from './styles'

type SigningRoutesProps = {
    request: TransactionSignRequest
}

const Stack = createStackNavigator<SigningStackParamList>()

type InitialRouteConfig = {
    name: keyof SigningStackParamList
}

const getInitialRouteConfig = (
    request: TransactionSignRequest,
): InitialRouteConfig => {
    const isSingleTransaction = request.txs.length === 1

    if (isSingleTransaction) {
        return { name: 'SingleTransaction' }
    }
    return { name: 'TransactionList' }
}

export const SigningRoutes = ({ request }: SigningRoutesProps) => {
    const initialRouteConfig = useMemo(
        () => getInitialRouteConfig(request),
        [request],
    )
    const styles = useStyles()
    return (
        <Stack.Navigator
            initialRouteName={initialRouteConfig.name}
            detachInactiveScreens={false}
            screenOptions={{
                headerShown: false,
                cardStyle: styles.screenContent,
                detachPreviousScreen: false,
            }}
        >
            <Stack.Screen
                name='SingleTransaction'
                component={SingleTransactionScreen}
            />
            <Stack.Screen
                name='TransactionList'
                component={TransactionListScreen}
            />
            <Stack.Screen
                name='TransactionDetails'
                component={TransactionDetailsScreen}
            />
            <Stack.Screen
                name='GroupDetail'
                component={GroupDetailScreen}
            />
        </Stack.Navigator>
    )
}
