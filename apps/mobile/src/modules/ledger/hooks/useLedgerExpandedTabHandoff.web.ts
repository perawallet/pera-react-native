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

import {
    getSurface,
    openExpandedTab,
} from '@perawallet/wallet-extension-platform-chrome'
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'
import type { UseLedgerExpandedTabHandoffResult } from './useLedgerExpandedTabHandoff'

/**
 * WebHID's and Web Bluetooth's `requestDevice()` device-picker dialog isn't
 * reliably shown from the extension's 360x600 toolbar popup — same
 * blur-fragile-surface problem as the QR camera-permission prompt
 * (`QRScannerContent.web.tsx`). When running in the popup, the Ledger scan
 * screen hands off to the full expanded tab (already knowing which
 * transport the user picked) instead of attempting the picker in-place.
 */
export const useLedgerExpandedTabHandoff =
    (): UseLedgerExpandedTabHandoffResult => ({
        isPopupSurface: getSurface() === 'popup',
        openLedgerExpandedTab: (transportType: LedgerTransportType) =>
            openExpandedTab(
                transportType === 'usb' ? 'ledger-usb' : 'ledger-ble',
            ),
    })
