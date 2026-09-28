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

import type { HardwareWalletRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { WithLedgerExtension } from '@perawallet/wallet-extension-ledger-react-native'
import { WithLedgerUsbExtension } from '@perawallet/wallet-extension-ledger-react-native-usb'

// The app, not the provider, picks the concrete transports so that packages
// depending on the provider never pull in the BLE/USB driver graph. Metro
// resolves the `.web.ts` sibling for web bundles.
export const registerHardwareWalletTransports = (
    hardwareWalletRegistry: HardwareWalletRegistry,
): void => {
    WithLedgerExtension({ hardwareWalletRegistry })
    WithLedgerUsbExtension({ hardwareWalletRegistry })
}
