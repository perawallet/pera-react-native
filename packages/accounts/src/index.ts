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

export const name = '@perawallet/wallet-core-accounts'

// Side effect: keeps each account's rekeyAddress mirror in lockstep with the
// active network (see the module for rationale).
import './store/network-rekey-sync'

export * from './constants'
export * from './models'
export * from './hooks'
export * from './errors'
export * from './utils'
export * from './bip44'
export * from './account-discovery'
export * from './db'
export * from './cleanup'
export * from './import-session'

export { useAccountsStore } from './store'
export {
    fetchAndPersistAccount,
    ensureAccountFetched,
    syncAndEnrichNewAccount,
    type AccountSyncResult,
} from './sync/account-syncer'

export {
    setPendingAccountRollback,
    clearPendingAccountRollback,
    consumePendingAccountRollback,
    usePendingAccountCreationStore,
} from './store'

export {
    setPendingImportMnemonic,
    clearPendingImportMnemonic,
    consumePendingImportMnemonic,
    usePendingImportMnemonicStore,
} from './store'

export {
    buildDeviceAccountRegistrations,
    toDeviceAccountType,
} from './device-accounts'
