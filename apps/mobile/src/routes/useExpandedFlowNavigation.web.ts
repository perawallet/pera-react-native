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

export type ExpandedFlowScreen = 'AddAccount' | 'BackupWallet' | 'ScanQR'

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
        }
    }, [navigate])
