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

import { NavigationContainer } from '@react-navigation/native'
import { BottomSheetManager } from '@modules/bottom-sheet'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { StakingScreen } from '@modules/staking/screens/StakingScreen'
import { BannersCarouselModalScreen } from '@modules/banners'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import {
    OnboardingStackNavigator,
    AddAccountStackNavigator,
} from '@modules/onboarding/routes'
import { screenListeners } from './listeners'
import { TabBarStackNavigator } from './tabbar'
import { ContactsStackNavigator } from '@modules/contacts/routes'
import { SettingsStackNavigator } from '@modules/settings/routes'
import { useShowOnboarding } from '@hooks/useShowOnboarding'
import { NavigationHeader } from '@components/NavigationHeader'
import { getNavigationTheme } from '@theme/theme'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { TransactionDetailsScreen } from '@modules/signing/screens/TransactionDetailsScreen'
import { GroupTransactionListScreen } from '@modules/transactions/screens/GroupTransactionListScreen'
import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import { useIsOnboarding } from '@modules/onboarding/hooks'

import { RootStackParamList } from './types'
import { fullScreenLayout } from '@layouts/index'
import { MessagesStackNavigator } from '@modules/messages/routes'
import { MultisigStackNavigator } from '@modules/multisig'
import { BackupStackNavigator } from '@modules/backup'
import { RekeyToLedgerStackNavigator } from '@modules/rekey/routes/rekey-to-ledger'
import { RekeyToSharedStackNavigator } from '@modules/rekey/routes/rekey-to-shared'
import { RekeyToStandardStackNavigator } from '@modules/rekey/routes/rekey-to-standard'
import { RescanRekeyedStackNavigator } from '@modules/rekey/routes/rescan-rekeyed'
import { UndoRekeyStackNavigator } from '@modules/rekey/routes/undo-rekey'
import { SearchStackNavigator } from '@modules/search'
import { navigationRef } from './navigationRef'

const RootStack = createNativeStackNavigator<RootStackParamList>()

export const MainRoutes = () => {
    const showOnboarding = useShowOnboarding()
    const isDarkMode = useIsDarkMode()
    const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light')
    const hasAccounts = useHasAccounts()
    const { isOnboarding } = useIsOnboarding()

    return (
        <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
        >
            <BottomSheetManager />
            <RootStack.Navigator
                screenOptions={{
                    headerShown: false,
                    statusBarStyle: isDarkMode ? 'light' : 'dark',
                    ...SCREEN_ANIMATION_CONFIG,
                }}
                screenListeners={screenListeners}
            >
                {showOnboarding && (
                    <RootStack.Screen
                        name='Onboarding'
                        component={OnboardingStackNavigator}
                    />
                )}
                {hasAccounts && !isOnboarding && (
                    <>
                        <RootStack.Screen
                            name='TabBar'
                            component={TabBarStackNavigator}
                        />
                        <RootStack.Screen
                            name='Messages'
                            options={{
                                headerShown: false,
                            }}
                            layout={fullScreenLayout}
                            component={MessagesStackNavigator}
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
                            name='AddAccount'
                            component={AddAccountStackNavigator}
                        />
                        <RootStack.Screen
                            name='Multisig'
                            component={MultisigStackNavigator}
                        />
                        <RootStack.Screen
                            name='BackupWallet'
                            component={BackupStackNavigator}
                            options={{ headerShown: false }}
                        />
                        <RootStack.Screen
                            name='RekeyToStandard'
                            component={RekeyToStandardStackNavigator}
                        />
                        <RootStack.Screen
                            name='UndoRekey'
                            component={UndoRekeyStackNavigator}
                        />
                        <RootStack.Screen
                            name='RekeyToLedger'
                            component={RekeyToLedgerStackNavigator}
                        />
                        <RootStack.Screen
                            name='RekeyToShared'
                            component={RekeyToSharedStackNavigator}
                        />
                        <RootStack.Screen
                            name='RescanRekeyed'
                            component={RescanRekeyedStackNavigator}
                        />
                        <RootStack.Screen
                            name='Staking'
                            options={{
                                headerShown: true,
                                title: 'staking.title',
                                header: (props: NativeStackHeaderProps) => (
                                    <NavigationHeader {...props} />
                                ),
                            }}
                            layout={fullScreenLayout}
                            component={StakingScreen}
                        />
                        <RootStack.Screen
                            name='BannersCarouselModal'
                            component={BannersCarouselModalScreen}
                            options={{
                                presentation: 'modal',
                                headerShown: false,
                            }}
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
                    </>
                )}
            </RootStack.Navigator>
        </NavigationContainer>
    )
}
