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

import { useCallback } from 'react'
import { consumeInitialExpandedFlow } from '@perawallet/wallet-extension-platform-chrome'
import { useIsOnboarding } from '@modules/onboarding/hooks'

export type ExpandedFlowScreen = 'AddAccount' | 'BackupWallet' | 'ScanQR'

/** Screens the onboarding stack can be deep-linked into from the popup. */
export type OnboardingFlowScreen = 'LedgerScan' | 'AsbImportBackup'

/**
 * Parses the one-shot `?flow=` deep-link param the popup passed to
 * expanded.html and dispatches the matching navigate call. Returns a stable
 * callback meant to be used as the root NavigationContainer's `onReady`.
 *
 * `ledger-usb`/`ledger-ble` deep-link past `AddAccount`'s default screen
 * straight into its nested `LedgerScan`, since WebHID/Web Bluetooth's
 * `requestDevice()` picker doesn't reliably show from the 360x600 popup —
 * the popup hands off to this expanded tab already knowing which transport
 * the user picked.
 */
export const useExpandedFlowNavigation = (
    navigate: (screen: ExpandedFlowScreen, params?: object) => void,
): (() => void) =>
    useCallback((): void => {
        const flow = consumeInitialExpandedFlow()
        if (flow === 'add-account') {
            navigate('AddAccount')
        } else if (flow === 'backup-wallet') {
            navigate('BackupWallet')
        } else if (flow === 'scan') {
            navigate('ScanQR')
        } else if (flow === 'ledger-usb') {
            navigate('AddAccount', {
                screen: 'LedgerScan',
                params: { transportType: 'usb' },
            })
        } else if (flow === 'ledger-ble') {
            navigate('AddAccount', {
                screen: 'LedgerScan',
                params: { transportType: 'ble' },
            })
        } else if (flow === 'asb-import') {
            navigate('AddAccount', { screen: 'AsbImportBackup' })
        }
    }, [navigate])

/**
 * Onboarding-stack counterpart of `useExpandedFlowNavigation`, for a hand-off
 * that happens *before* the first account exists — the shell is in its
 * 'onboarding' state, so the main root stack (and its 'AddAccount' route)
 * isn't mounted and the mapping above can't apply. Same one-shot
 * `consumeInitialExpandedFlow` source: the two shell states are exclusive, so
 * only one of these ever consumes the param.
 *
 * `add-account`/`backup-wallet`/`scan` are deliberately unhandled — they only
 * exist in the main shell and are unreachable with no account.
 */
export const useOnboardingExpandedFlowNavigation = (
    navigate: (screen: OnboardingFlowScreen, params?: object) => void,
): (() => void) => {
    const { setIsOnboarding } = useIsOnboarding()

    return useCallback((): void => {
        const flow = consumeInitialExpandedFlow()
        if (
            flow !== 'ledger-usb' &&
            flow !== 'ledger-ble' &&
            flow !== 'asb-import'
        ) {
            return
        }

        // The store is per-realm in-memory, so this fresh tab starts with
        // isOnboarding false and `useShowOnboarding` holding the stack open
        // only via `noAccounts`. Importing the account would then flip the
        // shell to 'main' and unmount this stack mid-flow.
        setIsOnboarding(true)

        if (flow === 'asb-import') {
            navigate('AsbImportBackup')
        } else {
            navigate('LedgerScan', {
                transportType: flow === 'ledger-usb' ? 'usb' : 'ble',
            })
        }
    }, [navigate, setIsOnboarding])
}
