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

// Web implementation of @perawallet/wallet-extension-ledger-react-native.
// Metro's webStubs (apps/mobile/metro.config.js) alias the bare specifier to
// this file for web builds. The native package's export surface
// (WithLedgerExtension, RNLedgerService, name) is re-exported here, backed
// by Web Bluetooth (@ledgerhq/hw-transport-web-ble) instead of
// @ledgerhq/react-native-hw-transport-ble.

export {
    WithLedgerWebBleExtension as WithLedgerExtension,
    LedgerWebBleService as RNLedgerService,
} from '@perawallet/wallet-extension-ledger-web-ble'

export const name = '@perawallet/wallet-extension-ledger-react-native'
