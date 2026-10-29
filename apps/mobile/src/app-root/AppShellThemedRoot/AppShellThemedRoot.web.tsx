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

import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AppProviders, type AppProvidersProps } from '@providers/AppProviders'
import { VaultGate } from '@modules/vault'
import { PWView } from '@components/core'
import { TestnetIndicator } from '@components/TestnetIndicator'
import { IntegrityBanner } from '@components/IntegrityBanner'
import { IntegrityCheckFrameHost } from '@components/IntegrityCheckFrameHost'
import { OfflineBanner } from '@components/OfflineBanner'
import { useNetworkStatusListener } from '@modules/network'
import { usePhishingListRehydration } from '@modules/site-safety/web'
import { useAppShellRootStyles } from '../styles.web'
import { NetworkSwitchInvalidation } from '../NetworkSwitchInvalidation'
import { ActivityAutoLock } from '../ActivityAutoLock'
import { ShellRouter } from '../ShellRouter'

// Splitting this out of AppShellContent is load-bearing: a makeStyles hook in
// the same component that *renders* ThemeProvider runs with no theme context
// and throws `Cannot read properties of undefined (reading 'colors')`.
export type AppShellThemedRootProps = {
    persister: AppProvidersProps['persister']
}

export const AppShellThemedRoot = ({
    persister,
}: AppShellThemedRootProps): React.JSX.Element => {
    const rootStyles = useAppShellRootStyles()

    // Native does this in RootComponent, which the web shell replaces — so
    // without it here the reachability probe never runs and onlineManager
    // keeps whatever seed initNetworkStatus left.
    useNetworkStatusListener()
    usePhishingListRehydration()

    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={rootStyles.root}>
                <PWView style={rootStyles.card}>
                    <TestnetIndicator />
                    <AppProviders persister={persister}>
                        <NetworkSwitchInvalidation />
                        {/* VaultGate OUTERMOST inside providers: locked ⇒ nothing else renders */}
                        <VaultGate>
                            <ShellRouter />
                        </VaultGate>
                        <ActivityAutoLock />
                        {/* Outside VaultGate: locking must not kill a check mid-solve, and enrolment needs no unlocked vault. */}
                        <IntegrityCheckFrameHost />
                    </AppProviders>
                    {/* Same contract as RootComponent's: LAST node inside the
                        card so it paints above navigation and sheets. */}
                    <OfflineBanner />
                    {/* Hides itself while offline, so the two pills never stack. */}
                    <IntegrityBanner />
                </PWView>
            </GestureHandlerRootView>
        </SafeAreaProvider>
    )
}
