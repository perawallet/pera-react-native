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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AccountsState, WalletAccount } from '../models'
import { useAccountsStore } from './store'

// Plain functions for event-time reads: a value a hook captured at render goes
// stale across an `await`, these read the store when they are called.

export const getAllAccounts = (): WalletAccount[] =>
    useAccountsStore.getState().accounts

export const getSelectedAccount = (): Nullable<WalletAccount> =>
    useAccountsStore.getState().getSelectedAccount()

export const getSelectedAccountId = (): Nullable<string> =>
    useAccountsStore.getState().selectedAccountId

export const importAccountFromPrivateKey: AccountsState['importAccountFromPrivateKey'] =
    (...args) =>
        useAccountsStore.getState().importAccountFromPrivateKey(...args)

export const addHardwareChainAccount: AccountsState['addHardwareChainAccount'] =
    (...args) => useAccountsStore.getState().addHardwareChainAccount(...args)

export const upgradeWatchAccountToHardware: AccountsState['upgradeWatchAccountToHardware'] =
    (...args) =>
        useAccountsStore.getState().upgradeWatchAccountToHardware(...args)

export const updateHardwareDetails: AccountsState['updateHardwareDetails'] = (
    ...args
) => useAccountsStore.getState().updateHardwareDetails(...args)
