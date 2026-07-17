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

import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import {
    createStackNavigator,
    type StackHeaderProps,
} from '@react-navigation/stack'
import type { SigningStackParamList } from './types'
import {
    SingleTransactionScreen,
    TransactionDetailsScreen,
    TransactionListScreen,
    GroupDetailScreen,
    ArbitraryDataSigningScreen,
    ArbitraryDataSigningDetailsScreen,
    Arc60SigningScreen,
    Arc60SigningDetailsScreen,
} from '@modules/signing/screens'
import { SettingsSecurityScreen } from '@modules/settings/screens/SettingsSecurityScreen'
import { NavigationHeader } from '@components/NavigationHeader'
import { useStyles } from './styles'
import { bottomSheetLayout } from '@layouts/index'

const Stack = createStackNavigator<SigningStackParamList>()

type InitialRouteConfig = {
    initialRoute: keyof SigningStackParamList
}

const useInitialRouteConfig = (): InitialRouteConfig | null => {
    const { resolved } = useSigningPipeline()
    if (!resolved) return null
    switch (resolved.kind.type) {
        case 'arbitrary-data': {
            return { initialRoute: 'ArbitraryDataSigning' }
        }
        case 'arc60': {
            return { initialRoute: 'Arc60Signing' }
        }
        case 'transactions': {
            return resolved.kind.hasMultiple
                ? { initialRoute: 'TransactionList' }
                : { initialRoute: 'SingleTransaction' }
        }
    }
}

// Bound to the sheet's request via the SigningRequestScopeProvider that
// SignRequestContent mounts above this tree — useSigningPipeline (and every
// signing hook in the screens below) resolves that request, not the queue head.
export const SigningRoutes = () => {
    const initialRouteConfig = useInitialRouteConfig()
    const styles = useStyles()
    if (!initialRouteConfig) return null
    return (
        <Stack.Navigator
            initialRouteName={initialRouteConfig.initialRoute}
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
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name='ArbitraryDataSigningDetails'
                component={ArbitraryDataSigningDetailsScreen}
                options={{ title: 'signing.arbitrary_data_view.details_title' }}
            />
            <Stack.Screen
                name='Arc60Signing'
                component={Arc60SigningScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name='Arc60SigningDetails'
                component={Arc60SigningDetailsScreen}
                options={{ title: 'signing.arc60_view.details_title' }}
            />
        </Stack.Navigator>
    )
}
