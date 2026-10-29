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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { screenListeners } from '@routes/listeners'
import { SettingsWalletConnectScreen } from '@modules/settings/screens/SettingsWalletConnectScreen'
import { fullScreenLayout } from '@layouts/index'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'
import { SettingsWalletConnectDetailsScreen } from '@modules/settings/screens/SettingsWalletConnectDetailsScreen/SettingsWalletConnectDetailsScreen'

export type WalletConnectSettingsStackParamsList = {
    WalletConnectSettingsHome: undefined
    WalletConnectSettingsDetails: { connection: ConnectionSettingsRow }
}

const WalletConnectSettingsStack =
    createAppStackNavigator<WalletConnectSettingsStackParamsList>()

export const WalletConnectSettingsStackNavigator = () => {
    return (
        <WalletConnectSettingsStack.Navigator
            initialRouteName='WalletConnectSettingsHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={fullScreenLayout}
        >
            <WalletConnectSettingsStack.Screen
                name='WalletConnectSettingsHome'
                options={{
                    title: 'screens.wallet_connect',
                }}
                component={SettingsWalletConnectScreen}
            />
            <WalletConnectSettingsStack.Screen
                name='WalletConnectSettingsDetails'
                options={{
                    title: 'screens.wallet_connect_details',
                }}
                component={SettingsWalletConnectDetailsScreen}
            />
        </WalletConnectSettingsStack.Navigator>
    )
}
