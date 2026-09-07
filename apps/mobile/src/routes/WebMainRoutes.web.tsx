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

// The web-capable subset of the root routes; onboarding and migration gating
// live in useWebAppShell. Search and Messages navigate in-place: their entry
// screens are web-safe and the deep leaves are off-capability. Sharing
// `navigationRef` with the onboarding container is safe: the two never mount together.
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import ErrorBoundary from 'react-native-error-boundary'
import { useDeviceRegistration } from '@perawallet/wallet-core-device'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useTokenListener } from '@modules/token'
import { PromptContainer } from '@modules/prompts'
import { useNotificationDeeplinkListener } from '@hooks/useNotificationDeeplinkListener'
import { useNotificationReceivedListener } from '@hooks/useNotificationReceivedListener'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { screenListeners } from './listeners'
import { TabBarStackNavigator } from './tabbar'
import { ContactsStackNavigator } from '@modules/contacts/routes'
import { SettingsStackNavigator } from '@modules/settings/routes'
import { SearchStackNavigator } from '@modules/search/routes'
import { MessagesStackNavigator } from '@modules/messages/routes'
import { PeraCardStackNavigator, peraCardFlowScreens } from '@modules/card'
import { AddAccountStackNavigator } from '@modules/onboarding/routes'
import { BackupStackNavigator } from '@modules/backup'
import { ScanQRScreen } from '@modules/menu/screens/ScanQRScreen'
import { getNavigationTheme } from '@theme/theme'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { TransactionDetailsScreen } from '@modules/signing/screens/TransactionDetailsScreen'
import { GroupTransactionListScreen } from '@modules/transactions/screens/GroupTransactionListScreen'
import { StakingScreen } from '@modules/staking/screens/StakingScreen'
import { BannersCarouselModalScreen } from '@modules/banners/screens/BannersCarouselModalScreen'
import { MultisigStackNavigator } from '@modules/multisig'
import { RekeyToLedgerStackNavigator } from '@modules/rekey/routes/rekey-to-ledger'
import { RekeyToQuantumStackNavigator } from '@modules/rekey/routes/rekey-to-quantum'
import { RekeyToSharedStackNavigator } from '@modules/rekey/routes/rekey-to-shared'
import { RekeyToStandardStackNavigator } from '@modules/rekey/routes/rekey-to-standard'
import { RescanRekeyedStackNavigator } from '@modules/rekey/routes/rescan-rekeyed'
import { UndoRekeyStackNavigator } from '@modules/rekey/routes/undo-rekey'
import { withAgeGate } from '@components/AgeGated'
import { fullScreenLayout } from '@layouts/index'
import { headeredScreen } from './screen-options'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { ConnectionsProvider } from '@modules/connections'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { OverlayErrorFallback } from '@components/RootComponent/OverlayErrorFallback'
import { navigationRef } from './navigationRef'
import { createAppStackNavigator } from './createAppStackNavigator'
import { createExpandedRedirect } from './createExpandedRedirect.web'
import { useExpandedFlowNavigation } from './useExpandedFlowNavigation.web'
import { routeCapabilities } from '@routes/capabilities'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'
import type { RootStackParamList } from './types'

const RootStack = createAppStackNavigator<RootStackParamList>()

// Blur-fragile flows mount a redirect stand-in that opens the expanded tab.
// AddAccount runs in-place on every surface (a new tab severs the flow); Backup
// stays redirected because a focus-steal while the recovery phrase is shown risks data loss.
const isPopup = getSurface() === 'popup'
const AddAccountComponent = AddAccountStackNavigator
const BackupComponent = isPopup
    ? createExpandedRedirect('backup-wallet')
    : BackupStackNavigator

// Staking is age-gated at the navigator exactly as native routes/index.tsx.
const GatedStakingScreen = withAgeGate(StakingScreen)

// SigningOverlays hosts money flows, so an unhandled render-throw must not
// unwind the whole popup. react-native-error-boundary and OverlayErrorFallback are web-safe as-is.
const handleOverlayError = (error: string | Error) => {
    logger.critical(error, { source: 'WebMainRoutesOverlaysErrorBoundary' })
}

export type WebMainRoutesProps = {
    fcmToken: Nullable<string>
}

export const WebMainRoutes = ({
    fcmToken,
}: WebMainRoutesProps): React.JSX.Element => {
    const isDarkMode = useIsDarkMode()
    const isPeraCardEnabled = useIsPeraCardEnabled()
    useDeviceRegistration(useDeviceAccountRegistrations())
    // Native mounts these in RootComponent, which the web shell replaces; without
    // them devices register with no push token and notification-tap deeplinks drop.
    useTokenListener(fcmToken)
    useNotificationDeeplinkListener()
    useNotificationReceivedListener()
    const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light')

    const handleReady = useExpandedFlowNavigation((screen, params) => {
        navigationRef.navigate(screen, params)
    })

    return (
        <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
            onReady={handleReady}
        >
            {/* Outside ConnectionsProvider, as native's BottomSheetModalProvider
                sits above the provider: SigningOverlays needs the sheet host
                to survive a nav-tree crash. */}
            <BottomSheetManager />
            {/* Wraps only the nav tree: its WalletConnectErrorBoundary
                REPLACES children on an uncaught throw, so the sheet host and
                SigningOverlays stay outside. */}
            <ConnectionsProvider>
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
                    {routeCapabilities.peraCard && isPeraCardEnabled && (
                        <>
                            <RootStack.Screen
                                name='PeraCard'
                                component={PeraCardStackNavigator}
                            />
                            {peraCardFlowScreens.map(screen => (
                                <RootStack.Screen
                                    key={screen.name}
                                    name={screen.name}
                                    options={screen.options}
                                    layout={fullScreenLayout}
                                    component={screen.component}
                                />
                            ))}
                        </>
                    )}
                    <RootStack.Screen
                        name='Staking'
                        options={headeredScreen('staking.title')}
                        layout={fullScreenLayout}
                        component={GatedStakingScreen}
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
                        options={headeredScreen(
                            'transactions.group.group_number',
                        )}
                    />
                    <RootStack.Screen
                        name='TransactionDetails'
                        layout={fullScreenLayout}
                        component={TransactionDetailsScreen}
                        options={headeredScreen('signing.transactions.details')}
                    />
                    <RootStack.Screen
                        name='BannersCarouselModal'
                        component={BannersCarouselModalScreen}
                        options={{
                            presentation: 'modal',
                            headerShown: false,
                        }}
                    />
                    {routeCapabilities.sharedAccounts && (
                        <RootStack.Screen
                            name='Multisig'
                            component={MultisigStackNavigator}
                        />
                    )}
                    {routeCapabilities.rekeyFlows && (
                        <>
                            <RootStack.Screen
                                name='UndoRekey'
                                component={UndoRekeyStackNavigator}
                            />
                            <RootStack.Screen
                                name='RekeyToLedger'
                                component={RekeyToLedgerStackNavigator}
                            />
                            <RootStack.Screen
                                name='RekeyToStandard'
                                component={RekeyToStandardStackNavigator}
                            />
                            <RootStack.Screen
                                name='RekeyToQuantum'
                                component={RekeyToQuantumStackNavigator}
                            />
                            <RootStack.Screen
                                name='RekeyToShared'
                                component={RekeyToSharedStackNavigator}
                            />
                            <RootStack.Screen
                                name='RescanRekeyed'
                                component={RescanRekeyedStackNavigator}
                            />
                        </>
                    )}
                </RootStack.Navigator>
            </ConnectionsProvider>
            {/* Native mounts this in RootComponent, which this shell replaces.
                Outside the provider so a nav-tree crash cannot take the
                blocking prompt down. */}
            <PromptContainer />
            {/* Sibling of ConnectionsProvider: nothing else on web watches the
                signing queue, so a connection-delivered sign request would enqueue
                and never render. MultisigOverlays and SwapOverlays are native-only. */}
            <ErrorBoundary
                onError={handleOverlayError}
                FallbackComponent={OverlayErrorFallback}
            >
                <SigningOverlays />
            </ErrorBoundary>
        </NavigationContainer>
    )
}
