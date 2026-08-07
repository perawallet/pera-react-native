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

import { useEffect, useRef, useState } from 'react'
import {
    getCurrentApproval,
    getSurface,
} from '@perawallet/wallet-extension-platform-chrome'
import { armAutoLock } from '@perawallet/wallet-extension-keystore-chrome'
import { useVaultLockState } from '@modules/vault'
import { useShowOnboarding } from '@hooks/useShowOnboarding'
import { getKeystore, getProvider } from '@perawallet/wallet-extension-provider'
import {
    getDatabase,
    initializeDatabase,
} from '@perawallet/wallet-core-database'
import { seedAlgoAsset } from '@perawallet/wallet-core-assets'
import {
    getSyncService,
    initializeSyncService,
} from '@perawallet/wallet-core-background'
import { setOnConfirmedHandler } from '@perawallet/wallet-core-signing'
import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { queryClient } from '@providers/QueryProvider'

export type WebShellState =
    | 'resolving'
    | 'create-password'
    | 'onboarding'
    | 'main'
    | 'approval-placeholder'
    | 'dapp-request'
    | 'error'

type UseWebAppShellResult = { shellState: WebShellState }

export const useWebAppShell = (): UseWebAppShellResult => {
    const { isInitialized, isUnlocked } = useVaultLockState()
    const showOnboarding = useShowOnboarding()
    const hasAccounts = useHasAccounts()
    const [isBootstrapped, setIsBootstrapped] = useState(false)
    const [hasBootstrapError, setHasBootstrapError] = useState(false)
    const bootstrapStarted = useRef(false)
    // The toolbar popup (surface 'popup') can't receive a ?requestId query
    // param — chrome.action.openPopup() has no way to pass one — so unlike
    // the approval surface below, discovering a pending approval here (enable
    // OR sign: both open in the toolbar popup) means an async round-trip over
    // runtime messaging. null = still checking.
    const [hasPendingApproval, setHasPendingApproval] = useState<
        boolean | null
    >(null)
    const pendingApprovalCheckStarted = useRef(false)

    useEffect(() => {
        if (getSurface() !== 'popup' || pendingApprovalCheckStarted.current) {
            return
        }
        pendingApprovalCheckStarted.current = true
        void getCurrentApproval().then(approval => {
            setHasPendingApproval(approval !== null)
        })
    }, [])

    useEffect(() => {
        if (!isUnlocked || bootstrapStarted.current) return
        bootstrapStarted.current = true
        const bootstrap = async (): Promise<void> => {
            // Mirrors native App.tsx:126-156 minus native-only branches
            // (push token, passkey autofill, splash): keystore first (needs
            // the unlocked master key), then DB through the offscreen proxy,
            // then the sync service.
            await getKeystore().ready
            await initializeDatabase(getProvider().database)
            await seedAlgoAsset(getDatabase())
            initializeSyncService({
                queryClient,
                registerCompletionHandler: setOnConfirmedHandler,
            })
            setIsBootstrapped(true)
        }
        bootstrap().catch(error => {
            logger.error('Web shell bootstrap failed', { error })
            setHasBootstrapError(true)
        })
    }, [isUnlocked])

    useEffect(() => {
        if (!isUnlocked) return
        void armAutoLock() // sliding window: surface open re-arms
    }, [isUnlocked])

    // Sync runs while a UI context is open AND the wallet is usable
    // (spec: "Sync service: runs while any UI context is open"). Closing the
    // popup kills this context (no AppState dance needed); locking stops it.
    useEffect(() => {
        if (!isBootstrapped || !isUnlocked || !hasAccounts) return
        getSyncService().start()
        return () => {
            getSyncService().stop()
        }
    }, [isBootstrapped, isUnlocked, hasAccounts])

    if (getSurface() === 'approval') {
        // The SW's approval bridge opens this popup at
        // approval.html?requestId=…; a requestId in the query string means
        // there's a real ARC-0027 enable request to render. Any other
        // navigation into the approval surface (e.g. opened by hand) falls
        // back to the placeholder. This check stays ahead of the
        // resolving/create-password/error branches below — same as before
        // 'dapp-request' existed — so the approval surface never blocks on
        // full portfolio bootstrap to show either state.
        const requestId = new URLSearchParams(window.location.search).get(
            'requestId',
        )
        return {
            shellState: requestId ? 'dapp-request' : 'approval-placeholder',
        }
    }
    if (getSurface() === 'popup' && hasPendingApproval !== false) {
        // Overlaps the vault/bootstrap resolution below: both start out
        // 'resolving', so a popup with no pending approval isn't perceptibly
        // delayed by this check before falling through to the normal flow.
        if (hasPendingApproval === null) return { shellState: 'resolving' }
        return { shellState: 'dapp-request' }
    }
    if (hasBootstrapError) return { shellState: 'error' }
    if (isInitialized === null || isUnlocked === null) {
        return { shellState: 'resolving' }
    }
    if (!isInitialized) return { shellState: 'create-password' }
    if (isUnlocked && !isBootstrapped) return { shellState: 'resolving' }
    // isInitialized && !isUnlocked never reaches here — VaultGate intercepts.
    return { shellState: showOnboarding ? 'onboarding' : 'main' }
}
