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

export const name = '@perawallet/wallet-extension-ledger-react-native'

export { WithLedgerExtension } from './extension'
export { RNLedgerService } from './RNLedgerService'
// Re-exported so existing consumers of this package's barrel keep working;
// the shared core itself now lives in its own package (it has no react-native
// dependency, and the two web transports were importing it through a package
// named "react-native").
export * from '@perawallet/wallet-extension-ledger-shared'
