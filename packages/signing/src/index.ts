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

export const name = '@perawallet/wallet-core-signing'

export * from './constants'
export * from './models'
export * from './hooks'
export * from './utils'
export * from './pipeline'
export * from './ledger'
export * from './db'

export {
    useWalletConnectHandoffsStore,
    type WalletConnectHandoffsStore,
} from './store/walletConnectHandoffsStore'

export { useHardwareSigningStore } from './store/hardwareSigningStore'

export { BLE_CLASS_ERROR_KINDS } from './types/ledgerErrorPresetKind'

export type { LedgerErrorPresetKind } from './types/ledgerErrorPresetKind'
