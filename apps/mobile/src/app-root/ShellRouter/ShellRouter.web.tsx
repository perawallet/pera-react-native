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
import { BottomSheetManager } from '@modules/bottom-sheet'
import {
    NavigationContainer,
    useNavigationContainerRef,
    type ParamListBase,
} from '@react-navigation/native'
import { CreatePasswordScreen } from '@modules/vault'
import { OnboardingStackNavigator } from '@modules/onboarding/routes'
import { useLedgerHandoffTabExit } from '@modules/ledger'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { DeviceRegistrar } from '@components/DeviceRegistrar'
import {
    CameraTabResult,
    useCameraTabResultStore,
} from '@components/CameraTabResult'
import { EmptyView } from '@components/EmptyView/EmptyView'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { getNavigationTheme } from '@theme/theme'
import { WebMainRoutes } from '@routes/WebMainRoutes.web'
import { useOnboardingExpandedFlowNavigation } from '@routes/useExpandedFlowNavigation.web'
import { DappRequestRoutes } from '@modules/dapp'
import { subscribeToIntegrityReady } from '@hooks/useIntegrityAccessStore.web'
import { useWebAppShell } from '../../useWebAppShell.web'
import { ApprovalPlaceholder } from '../ApprovalPlaceholder'
import { MainSurfaceLifecycle } from '../MainSurfaceLifecycle'

export const ShellRouter = (): React.JSX.Element => {
    const { shellState, fcmToken } = useWebAppShell()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    // Not the shared `routes/navigationRef`: global handlers (deep links,
    // notification taps) only know main-shell routes, and binding it here would
    // turn their isReady()===false no-op during onboarding into a bad navigate.
    const onboardingNavigationRef = useNavigationContainerRef<ParamListBase>()
    const handleOnboardingReady = useOnboardingExpandedFlowNavigation(
        (screen, params) => {
            onboardingNavigationRef.navigate(screen, params)
        },
    )
    const handleLedgerTabExit = useLedgerHandoffTabExit()
    const cameraTabResult = useCameraTabResultStore(state => state.result)

    // Replaces the wallet UI rather than overlaying it, so a finished camera
    // tab can't be used as a second wallet next to the popup.
    if (
        cameraTabResult &&
        (shellState === 'main' || shellState === 'onboarding')
    ) {
        return <CameraTabResult />
    }

    switch (shellState) {
        case 'resolving': {
            return <FullScreenLoadingView />
        }
        case 'approval-placeholder': {
            return <ApprovalPlaceholder />
        }
        case 'dapp-request': {
            return <DappRequestRoutes />
        }
        case 'create-password': {
            return (
                <>
                    <CreatePasswordScreen
                        onDone={() => {
                            // no-op: createVault flips the session state, which
                            // useVaultLockState observes and re-routes to onboarding.
                        }}
                    />
                    {/* A wipe lands here with its success sheet queued. */}
                    <BottomSheetManager />
                </>
            )
        }
        case 'onboarding': {
            return (
                <>
                    {/* Native registers from RootComponent before any account
                        exists; a Cloud Backup restore during onboarding needs
                        that device id. */}
                    <DeviceRegistrar
                        subscribeToRetryEdge={subscribeToIntegrityReady}
                    />
                    {/* Themed so React Navigation's DefaultTheme grey background
                        doesn't paint the onboarding scene. */}
                    <NavigationContainer
                        ref={onboardingNavigationRef}
                        theme={getNavigationTheme(
                            isDarkMode ? 'dark' : 'light',
                        )}
                        onReady={handleOnboardingReady}
                        onStateChange={() =>
                            handleLedgerTabExit(
                                onboardingNavigationRef.getCurrentRoute()?.name,
                            )
                        }
                    >
                        <OnboardingStackNavigator />
                        <BottomSheetManager />
                    </NavigationContainer>
                </>
            )
        }
        case 'main': {
            // WebMainRoutes mounts its own BottomSheetManager inside its
            // NavigationContainer (native parity) — do not add another here.
            return (
                <>
                    <DeviceRegistrar
                        subscribeToRetryEdge={subscribeToIntegrityReady}
                    />
                    <MainSurfaceLifecycle />
                    <WebMainRoutes fcmToken={fcmToken} />
                </>
            )
        }
        case 'error': {
            return (
                <EmptyView
                    title={t('app.initialization_failed.title')}
                    body={t('app.initialization_failed.body')}
                />
            )
        }
    }
}
