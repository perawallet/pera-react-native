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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { AddAccountScreen } from '@modules/onboarding/screens/AddAccountScreen'
import { WatchInfoScreen } from '@modules/onboarding/screens/WatchInfoScreen'
import { WatchAccountScreen } from '@modules/onboarding/screens/WatchAccountScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen'
import { ImportAccountScreen } from '@modules/onboarding/screens/ImportAccountScreen'
import { ImportInfoScreen } from '@modules/onboarding/screens/ImportInfoScreen'
import { ImportSelectAddressesScreen } from '@modules/onboarding/screens/ImportSelectAddressesScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen'
import { SelectHDWalletScreen } from '@modules/onboarding/screens/SelectHDWalletScreen'
import { AccountErrorBoundary } from '@modules/accounts/components/AccountErrorBoundary/AccountErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { screenListeners } from '@routes/listeners'
import { fullScreenLayout } from '@layouts/index'
import type React from 'react'

import { AddAccountStackParamList } from './types'

// Wrap screens with AccountErrorBoundary to catch account-related errors
const withAccountErrorBoundary = <P extends object>(
    WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P> => {
    return (props: P) => {
        const { t } = useLanguage()
        return (
            <AccountErrorBoundary t={t}>
                <WrappedComponent {...props} />
            </AccountErrorBoundary>
        )
    }
}

const AddAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(AddAccountScreen)
const WatchInfoScreenWithErrorBoundary =
    withAccountErrorBoundary(WatchInfoScreen)
const WatchAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(WatchAccountScreen)
const NameAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(NameAccountScreen)
const ImportAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(ImportAccountScreen)
const ImportInfoScreenWithErrorBoundary =
    withAccountErrorBoundary(ImportInfoScreen)
const SearchAccountsScreenWithErrorBoundary =
    withAccountErrorBoundary(SearchAccountsScreen)
const ImportSelectAddressesScreenWithErrorBoundary = withAccountErrorBoundary(
    ImportSelectAddressesScreen,
)
const ImportRekeyedAddressesScreenWithErrorBoundary = withAccountErrorBoundary(
    ImportRekeyedAddressesScreen,
)
const SelectHDWalletScreenWithErrorBoundary =
    withAccountErrorBoundary(SelectHDWalletScreen)

const AddAccountStack = createNativeStackNavigator<AddAccountStackParamList>()

export const AddAccountStackNavigator = () => {
    return (
        <AddAccountStack.Navigator
            initialRouteName='AddAccountHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
        >
            <AddAccountStack.Screen
                name='AddAccountHome'
                options={{ headerShown: false }}
                layout={fullScreenLayout}
                component={AddAccountScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='SelectHDWallet'
                options={{
                    title: '',
                }}
                component={SelectHDWalletScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='WatchInfo'
                options={{
                    title: '',
                }}
                component={WatchInfoScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='WatchAccount'
                options={{
                    title: '',
                }}
                component={WatchAccountScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='NameAccount'
                options={{
                    title: '',
                }}
                component={NameAccountScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='ImportInfo'
                options={{
                    title: '',
                }}
                component={ImportInfoScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='ImportAccount'
                options={{
                    title: '',
                }}
                component={ImportAccountScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='SearchAccounts'
                options={{
                    headerShown: false,
                }}
                layout={fullScreenLayout}
                component={SearchAccountsScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='ImportSelectAddresses'
                options={{
                    title: '',
                }}
                component={ImportSelectAddressesScreenWithErrorBoundary}
            />
            <AddAccountStack.Screen
                name='ImportRekeyedAddresses'
                options={{
                    title: '',
                }}
                component={ImportRekeyedAddressesScreenWithErrorBoundary}
            />
        </AddAccountStack.Navigator>
    )
}
