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

// Web replacement for SigningRoutes — same root cause and fix as
// SendFundsRoutes.web.tsx. The native version nests a
// `@react-navigation/stack` (JS "Stack") navigator; its web CardContent
// ({flex: 1, overflow: 'hidden'}) relies on an ancestor providing a definite
// height, which PWBottomSheet.web's Modal and the popup approval surface
// don't — the card collapses to height 0. `@react-navigation/native-stack`
// doesn't hit this: its web screens (react-native-screens' Screen.web.js)
// are plain Views with a display toggle, no measure-then-clip step.
// SigningRoutes uses no JS-stack-only APIs, so the swap is a drop-in.
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import {
    createNativeStackNavigator,
    type NativeStackHeaderProps,
} from '@react-navigation/native-stack'
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

const Stack = createNativeStackNavigator<SigningStackParamList>()

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

export const SigningRoutes = () => {
    const initialRouteConfig = useInitialRouteConfig()
    const styles = useStyles()
    if (!initialRouteConfig) return null
    return (
        <Stack.Navigator
            initialRouteName={initialRouteConfig.initialRoute}
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader
                        {...props}
                        safeArea={false}
                    />
                ),
                contentStyle: styles.screenContent,
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
