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

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { OverlayErrorFallback } from './OverlayErrorFallback'
import { OfflineBanner } from '@components/OfflineBanner'
import ErrorBoundary from 'react-native-error-boundary'
import { useSyncNewAccounts } from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { DeviceRegistrar } from '@components/DeviceRegistrar'
import { useNetworkSwitchInvalidation } from '@hooks/useNetworkSwitchInvalidation'
import { useImageMemoryRelease } from '@hooks/useImageMemoryRelease'
import { ConnectionsProvider } from '@modules/connections/shell'
import { AutoLockGuard } from '@modules/security/shell'
import { SigningOverlays } from '@modules/signing/shell'
import {
    useSyncMultisigAccountsOnNetworkSwitch,
    MultisigOverlays,
} from '@modules/multisig/shell'
import { SwapOverlays } from '@modules/swap/shell'
import { useBackupSyncLifecycle } from '@modules/cloud-backup'
import { RootContentContainer } from './RootContentContainer'
import { useRootComponent } from './useRootComponent'

export type RootComponentProps = {
    fcmToken: Nullable<string>
}

// These overlays host signing/multisig/swap (money) flows outside the main
// content's error boundary, so an unhandled render-throw would unwind the whole
// app. Contain it; OverlayErrorFallback schedules a reset so they come back.
const handleOverlayError = (error: string | Error) => {
    logger.critical(error, { source: 'RootOverlaysErrorBoundary' })
}

export const RootComponent = ({ fcmToken }: RootComponentProps) => {
    useRootComponent()

    const { isChecking, needsMigration } = useNeedsMigration()
    const migrationInProgress = isChecking || needsMigration
    useSyncMultisigAccountsOnNetworkSwitch()
    // Accounts added mid-session get an immediate fetch: the background poll never
    // picks up an account whose activity predates its checkpoint. Gated on
    // migration because syncing before the migrated device id lands caches favorites as false.
    useSyncNewAccounts({ isEnabled: !migrationInProgress })

    useNetworkSwitchInvalidation()
    useImageMemoryRelease()

    useBackupSyncLifecycle()

    return (
        <>
            <BottomSheetModalProvider>
                {!migrationInProgress && <DeviceRegistrar />}
                <AutoLockGuard>
                    {/* The app's single connection registry: it owns every
                        handler's lifecycle, so exactly one may be mounted. */}
                    <ConnectionsProvider>
                        <RootContentContainer fcmToken={fcmToken} />
                    </ConnectionsProvider>
                    <ErrorBoundary
                        onError={handleOverlayError}
                        FallbackComponent={OverlayErrorFallback}
                    >
                        <SigningOverlays />
                        <MultisigOverlays />
                        <SwapOverlays />
                    </ErrorBoundary>
                </AutoLockGuard>
            </BottomSheetModalProvider>
            {/* LAST node in the root tree so it paints above navigation, sheet
                modals and the AutoLockGuard PIN overlay (zIndex.max). Keep it last. */}
            <OfflineBanner />
        </>
    )
}
