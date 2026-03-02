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

import type {
    SignRequest,
    TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    createStackNavigator,
    type StackHeaderProps,
} from '@react-navigation/stack'
import { useMemo } from 'react'
import type { SigningStackParamList } from './types'
import {
    SingleTransactionScreen,
    TransactionDetailsScreen,
    TransactionListScreen,
    GroupDetailScreen,
    ArbitraryDataSigningScreen,
    ArbitraryDataSigningDetailsScreen,
} from '@modules/signing/screens'
import { SettingsSecurityScreen } from '@modules/settings/screens/SettingsSecurityScreen'
import { NavigationHeader } from '@components/NavigationHeader'
import { useStyles } from './styles'
import { bottomSheetLayout } from '@layouts/index'

type SigningRoutesProps = {
    request: SignRequest
}

const Stack = createStackNavigator<SigningStackParamList>()

type InitialRouteConfig = {
    name: keyof SigningStackParamList
}

const getInitialRouteConfig = (request: SignRequest): InitialRouteConfig => {
    if (request.type === 'arbitrary-data') {
        return { name: 'ArbitraryDataSigning' }
    }

    const txRequest = request as TransactionSignRequest
    const isSingleTransaction = txRequest.txs.length === 1

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
            layout={bottomSheetLayout}
        >
            <Stack.Screen
                name='SingleTransaction'
                component={SingleTransactionScreen}
                options={{ title: 'signing.transactions.title' }}
            />
            <Stack.Screen
                name='TransactionList'
                component={TransactionListScreen}
                options={{ title: 'signing.transactions.title' }}
            />
            <Stack.Screen
                name='TransactionDetails'
                component={TransactionDetailsScreen}
                options={{ title: 'signing.transactions.details' }}
            />
            <Stack.Screen
                name='GroupDetail'
                component={GroupDetailScreen}
                options={{ title: 'transactions.group.group_number' }}
            />
            <Stack.Screen
                name='SecuritySettings'
                component={SettingsSecurityScreen}
                options={{ title: 'settings.security.antispam_section' }}
            />
            <Stack.Screen
                name='ArbitraryDataSigning'
                component={ArbitraryDataSigningScreen}
                options={{ title: 'signing.arbitrary_data_view.title' }}
            />
            <Stack.Screen
                name='ArbitraryDataSigningDetails'
                component={ArbitraryDataSigningDetailsScreen}
                options={{ title: 'signing.arbitrary_data_view.details_title' }}
            />
        </Stack.Navigator>
    )
}
