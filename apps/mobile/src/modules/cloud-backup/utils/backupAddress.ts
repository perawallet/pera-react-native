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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { accountBackupAddresses } from '@perawallet/wallet-core-backup'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * The address an account's backup row is named by: its first address on a
 * chain the backup carries, which leads its record. Undefined for an account
 * on no such chain: it has no backup record.
 */
export const backupAddressOf = (account: WalletAccount): Optional<string> =>
    accountBackupAddresses(account)[0]

export type BackupAccount = {
    account: WalletAccount
    /** The account's backup item key. */
    address: string
}

/** The accounts that have a backup item, each with its key. */
export const backupAccountsOf = (
    accounts: readonly WalletAccount[],
): BackupAccount[] =>
    accounts.flatMap(account => {
        const address = backupAddressOf(account)
        return address === undefined ? [] : [{ account, address }]
    })
