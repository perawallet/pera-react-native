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

// Web sibling of MainRoutes (routes/index.tsx): same container/theme/refs,
// web-capable subset of the root routes. Onboarding/migration gating lives in
// the web shell state machine (useWebAppShell), not here.
//
// Omissions vs native (each deliberate):
// - MigrationSplash: no legacy web data to migrate.
// - Onboarding: the shell state machine (useWebAppShell) handles this branch.
// - Multisig/PeraCard/Staking/rekey stacks/BannersCarouselModal:
//   native-only or off-capability for v1 (see routes/capabilities.web.ts).
// - statusBarStyle: native-only, dropped.
//
// Wired in-place (user-feedback #7): Search (portfolio ellipsis menu) and
// Messages (notifications bell) navigate inside the popup's own navigator,
// like Settings/Contacts — NOT via createExpandedRedirect. Their entry
// screens render web-safe; deep leaf screens (claim/multisig detail) are
// off-capability and unreachable in the funded-account-free web shell.
//
// Two NavigationContainers never mount simultaneously (onboarding vs main are
// exclusive shell states), so sharing `navigationRef` across both is safe.
import React, { useMemo } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { type NativeStackHeaderProps } from '@react-navigation/native-stack'
import { useDeviceRegistration } from '@perawallet/wallet-core-device'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { screenListeners } from './listeners'
import { TabBarStackNavigator } from './tabbar'
import { ContactsStackNavigator } from '@modules/contacts/routes'
import { SettingsStackNavigator } from '@modules/settings/routes'
import { SearchStackNavigator } from '@modules/search/routes'
import { MessagesStackNavigator } from '@modules/messages/routes'
import { AddAccountStackNavigator } from '@modules/onboarding/routes'
import { BackupStackNavigator } from '@modules/backup'
import { ScanQRScreen } from '@modules/menu/screens/ScanQRScreen'
import { NavigationHeader } from '@components/NavigationHeader'
import { getNavigationTheme } from '@theme/theme'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { TransactionDetailsScreen } from '@modules/signing/screens/TransactionDetailsScreen'
import { GroupTransactionListScreen } from '@modules/transactions/screens/GroupTransactionListScreen'
import { fullScreenLayout } from '@layouts/index'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { navigationRef } from './navigationRef'
import { createAppStackNavigator } from './createAppStackNavigator'
import { createExpandedRedirect } from './createExpandedRedirect'
import { useExpandedFlowNavigation } from './useExpandedFlowNavigation'
import { type RootStackParamList } from './types'

const RootStack = createAppStackNavigator<RootStackParamList>()

// Blur-fragile flows deep-link out of the popup (design spec): the popup
// mounts a redirect stand-in that immediately opens the expanded tab instead
// of the real stack navigator.
//
// Exception — AddAccount navigates in-place on every surface (product
// decision): opening "Add account" from the portfolio menu into a brand-new
// browser tab broke the in-extension flow entirely, so it runs inside the
// popup's own navigator like any other screen. Backup stays redirected: it
// renders the secret recovery phrase, where a focus-steal that tears down the
// popup mid-flow is a real data-loss/security risk, not just an annoyance.
const isPopup = getSurface() === 'popup'
const AddAccountComponent = AddAccountStackNavigator
const BackupComponent = isPopup
    ? createExpandedRedirect('backup-wallet')
    : BackupStackNavigator

export const WebMainRoutes = (): React.JSX.Element => {
    const isDarkMode = useIsDarkMode()
    const accounts = useAllAccounts()
    const addresses = useMemo(
        () => accounts?.map(account => account.address) ?? [],
        [accounts],
    )
    useDeviceRegistration(addresses)
    const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light')

    const handleReady = useExpandedFlowNavigation(screen => {
        navigationRef.navigate(screen)
    })

    return (
        <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
            onReady={handleReady}
        >
            <BottomSheetManager />
            <RootStack.Navigator
                screenOptions={{
                    headerShown: false,
                    ...SCREEN_ANIMATION_CONFIG,
                }}
                screenListeners={screenListeners}
            >
                <RootStack.Screen
                    name='TabBar'
                    component={TabBarStackNavigator}
                />
                <RootStack.Screen
                    name='ScanQR'
                    component={ScanQRScreen}
                />
                <RootStack.Screen
                    name='Settings'
                    component={SettingsStackNavigator}
                />
                <RootStack.Screen
                    name='Contacts'
                    component={ContactsStackNavigator}
                />
                <RootStack.Screen
                    name='Search'
                    component={SearchStackNavigator}
                />
                <RootStack.Screen
                    name='Messages'
                    component={MessagesStackNavigator}
                />
                <RootStack.Screen
                    name='AddAccount'
                    component={AddAccountComponent}
                />
                <RootStack.Screen
                    name='BackupWallet'
                    component={BackupComponent}
                    options={{ headerShown: false }}
                />
                <RootStack.Screen
                    name='GroupTransactionList'
                    layout={fullScreenLayout}
                    component={GroupTransactionListScreen}
                    options={{
                        headerShown: true,
                        header: (props: NativeStackHeaderProps) => (
                            <NavigationHeader {...props} />
                        ),
                        title: 'transactions.group.group_number',
                    }}
                />
                <RootStack.Screen
                    name='TransactionDetails'
                    layout={fullScreenLayout}
                    component={TransactionDetailsScreen}
                    options={{
                        headerShown: true,
                        header: (props: NativeStackHeaderProps) => (
                            <NavigationHeader {...props} />
                        ),
                        title: 'signing.transactions.details',
                    }}
                />
            </RootStack.Navigator>
        </NavigationContainer>
    )
}
