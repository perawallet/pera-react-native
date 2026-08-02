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

// Web sibling of MainRoutes: the web-capable subset of the root routes.
// Onboarding and migration gating live in useWebAppShell, not here, which is
// why both are absent below along with the native-only stacks.
//
// Search and Messages navigate in-place inside the popup's own navigator, NOT
// via createExpandedRedirect — their entry screens are web-safe, and the deep
// leaf screens are off-capability and unreachable here.
//
// Sharing `navigationRef` across both containers is safe: onboarding and main
// are exclusive shell states, so they never mount simultaneously.
import React, { useMemo } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { type NativeStackHeaderProps } from '@react-navigation/native-stack'
import ErrorBoundary from 'react-native-error-boundary'
import { useDeviceRegistration } from '@perawallet/wallet-core-device'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { screenListeners } from './listeners'
import { TabBarStackNavigator } from './tabbar'
import { ContactsStackNavigator } from '@modules/contacts/routes'
import { SettingsStackNavigator } from '@modules/settings/routes'
import { SearchStackNavigator } from '@modules/search/routes'
import { MessagesStackNavigator } from '@modules/messages/routes'
import { PeraCardStackNavigator } from '@modules/card'
import { AddAccountStackNavigator } from '@modules/onboarding/routes'
import { BackupStackNavigator } from '@modules/backup'
import { ScanQRScreen } from '@modules/menu/screens/ScanQRScreen'
import { NavigationHeader } from '@components/NavigationHeader'
import { getNavigationTheme } from '@theme/theme'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { TransactionDetailsScreen } from '@modules/signing/screens/TransactionDetailsScreen'
import { GroupTransactionListScreen } from '@modules/transactions/screens/GroupTransactionListScreen'
import { StakingScreen } from '@modules/staking/screens/StakingScreen'
import { withAgeGate } from '@components/AgeGated'
import { fullScreenLayout } from '@layouts/index'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { OverlayErrorFallback } from '@components/RootComponent/OverlayErrorFallback'
import { navigationRef } from './navigationRef'
import { createAppStackNavigator } from './createAppStackNavigator'
import { createExpandedRedirect } from './createExpandedRedirect'
import { useExpandedFlowNavigation } from './useExpandedFlowNavigation'
import { routeCapabilities } from '@routes/capabilities'
import { type RootStackParamList } from './types'

const RootStack = createAppStackNavigator<RootStackParamList>()

// Blur-fragile flows deep-link out of the popup: it mounts a redirect stand-in
// that opens the expanded tab instead of the real stack navigator.
//
// AddAccount is the exception and runs in-place on every surface — opening it
// in a new tab severed the in-extension flow. Backup stays redirected: it
// renders the recovery phrase, where a focus-steal mid-flow is a data-loss
// risk, not just an annoyance.
const isPopup = getSurface() === 'popup'
const AddAccountComponent = AddAccountStackNavigator
const BackupComponent = isPopup
    ? createExpandedRedirect('backup-wallet')
    : BackupStackNavigator

// Staking is age-gated at the navigator exactly as native routes/index.tsx.
const GatedStakingScreen = withAgeGate(StakingScreen)

// Mirrors native RootComponent's overlay error boundary: SigningOverlays hosts
// money flows (sign-review sheet), so an unhandled render-throw here must not
// unwind the whole popup. react-native-error-boundary is a plain class
// component (no native deps) and OverlayErrorFallback only touches
// `useEffect`, so both are web-safe as-is — reused verbatim rather than
// duplicated.
const handleOverlayError = (error: string | Error) => {
    logger.critical(error, { source: 'WebMainRoutesOverlaysErrorBoundary' })
}

export const WebMainRoutes = (): React.JSX.Element => {
    const isDarkMode = useIsDarkMode()
    const isPeraCardEnabled = useIsPeraCardEnabled()
    const accounts = useAllAccounts()
    const addresses = useMemo(
        () => accounts?.map(account => account.address) ?? [],
        [accounts],
    )
    useDeviceRegistration(addresses)
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
            {/* BottomSheetManager sits OUTSIDE WalletConnectProvider, mirroring
                native's BottomSheetModalProvider, which sits above both the WC
                provider and the overlays error boundary (RootComponent.tsx):
                the sheet host must survive a WC-boundary trip, since
                SigningOverlays (below) depends on it. JSX order still puts it
                first so it registers before the provider's effects can call
                request(). */}
            <BottomSheetManager />
            {/* Mirrors native RootComponent's AutoLockGuard > WalletConnectProvider
                nesting: this tree only renders with the vault unlocked.
                Unlike native, no WC socket is scoped to this mount — the
                offscreen document is the sole owner of WC v1 connectors on
                web (see apps/browser/src/offscreen/walletconnect/wcHost.ts),
                long-lived independent of whether this popup/tab is open at
                all. `useWalletConnectProvider.web.ts` is accordingly an
                inert no-op; this stays mounted purely for
                WalletConnectErrorBoundary, a real crash guard for the nav
                tree that has nothing to do with WC. The provider wraps ONLY
                the nav tree, same as native wraps only
                RootContentContainer — its WalletConnectErrorBoundary's
                fallback REPLACES children on an uncaught
                non-WalletConnectError, so anything that must survive a
                nav-tree crash (the sheet host, SigningOverlays below) has to
                live outside it. */}
            <WalletConnectProvider>
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
                        <RootStack.Screen
                            name='PeraCard'
                            component={PeraCardStackNavigator}
                        />
                    )}
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
            </WalletConnectProvider>
            {/* Sibling of WalletConnectProvider (not nested inside it),
                mirroring native RootComponent's arrangement: there,
                `<ErrorBoundary><SigningOverlays/>...</ErrorBoundary>` is a
                sibling of `<WalletConnectProvider><RootContentContainer/></WalletConnectProvider>`,
                both under AutoLockGuard — never inside the WC provider. The
                provider exposes no context, so nothing needs to be inside it,
                and nesting SigningOverlays there would let an unrelated
                nav-tree crash (caught by WalletConnectErrorBoundary, whose
                fallback replaces children) tear down an in-progress WC sign
                review along with it.
                SigningOverlays itself is needed because WalletConnectProvider
                (mounted above since M7 task 2) delivers interactive sign
                requests into the shared signing queue regardless of platform,
                and nothing else on web watches that queue to open the review
                sheet — without this, a WC-delivered sign request enqueues and
                never renders on web.
                MultisigOverlays is NOT mounted: multisig is native-only on
                this shell (see the omissions note atop this file).
                SwapOverlays is NOT mounted: its only job is
                useSwapCosignResolver, which is scoped to shared-account
                (multisig) swap completion (@perawallet/wallet-core-swaps
                useSwapCosignResolver.ts) — i.e. the same native-only
                multisig feature. Regular single-key swap signing on web is
                headless (not an INTERACTIVE_SOURCES sourceType) and doesn't
                route through either overlay. */}
            <ErrorBoundary
                onError={handleOverlayError}
                FallbackComponent={OverlayErrorFallback}
            >
                <SigningOverlays />
            </ErrorBoundary>
        </NavigationContainer>
    )
}
