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

import { useCallback, useRef } from 'react'
import {
    closeCurrentTab,
    getConsumedExpandedFlow,
} from '@perawallet/wallet-core-browser-runtime'

// The pairing tab only exists to host the device picker. Once the flow ends it
// must not become a second wallet UI next to the popup, so both the success
// screen and any exit from the Ledger screens close it.
export const isLedgerHandoffTab = (): boolean => {
    const flow = getConsumedExpandedFlow()
    return flow === 'ledger-usb' || flow === 'ledger-ble'
}

/**
 * For a NavigationContainer's `onStateChange`: in a Ledger pairing tab, closes
 * the tab as soon as navigation leaves the Ledger screens (cancel, back, or a
 * finished flow resetting to home), instead of showing what lies behind them.
 */
export const useLedgerHandoffTabExit = (): ((
    currentRouteName: string | undefined,
) => void) => {
    // Only an exit counts: nested navigators can report their initial state
    // before the deep link lands on the Ledger screens.
    const hasEnteredLedgerFlow = useRef(false)
    return useCallback((currentRouteName: string | undefined) => {
        if (!isLedgerHandoffTab() || currentRouteName === undefined) return
        if (currentRouteName.startsWith('Ledger')) {
            hasEnteredLedgerFlow.current = true
            return
        }
        if (hasEnteredLedgerFlow.current) void closeCurrentTab()
    }, [])
}
