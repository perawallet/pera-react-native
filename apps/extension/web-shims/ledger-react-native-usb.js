/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Web shim for @perawallet/wallet-extension-ledger-react-native-usb.
// The real package imports @ledgerhq/react-native-hid (USB HID transport) which
// requires native bridge modules unavailable in browser environments.
// On web, USB HID Ledger transport is unavailable; the registry has no USB provider.

export const name = '@perawallet/wallet-extension-ledger-react-native-usb'

// No-op: registers nothing into the hardware wallet registry (USB HID unavailable on web).
export const WithLedgerUsbExtension = (_provider) => ({})

// No-op class: mirrors RNLedgerUsbService shape without any HID dependency.
export class RNLedgerUsbService {
    createTransportProvider() {
        return null
    }
}
