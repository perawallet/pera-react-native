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

// Web shim for @perawallet/wallet-extension-ledger-react-native.
// The real package imports react-native-ble-plx which calls NativeModules.BlePlx
// at module-eval time — that throws __fbBatchedBridgeConfig in browser environments.
// On web, BLE hardware is unavailable; the registry simply has no Ledger BLE provider.

export const name = '@perawallet/wallet-extension-ledger-react-native'

// No-op: registers nothing into the hardware wallet registry (BLE unavailable on web).
export const WithLedgerExtension = (_provider) => ({})

// No-op class: mirrors RNLedgerService shape without any BLE dependency.
export class RNLedgerService {
    createTransportProvider() {
        return null
    }
}
