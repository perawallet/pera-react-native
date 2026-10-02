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

import { useCallback } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { backupAdapterFor } from '../../chain-adapter'
import type { PeraWebBackupAccount } from '../models'

export type UsePeraWebAccountImportResult = {
    importAccount: (account: PeraWebBackupAccount) => Promise<WalletAccount>
}

/**
 * Import a single account decrypted from a Pera Web backup into the wallet.
 *
 * Pera Web's "Transfer Accounts" flow only exports signing accounts (no
 * watch entries), so every row delegates to the chain's seed import.
 * `DuplicateAccountError` from the underlying import path is re-thrown so the
 * loading screen can bucket duplicates separately from real failures.
 */
export const usePeraWebAccountImport = (): UsePeraWebAccountImportResult => {
    const importFromSeed = backupAdapterFor().useImportFromSeed()

    const importAccount = useCallback(
        async (account: PeraWebBackupAccount): Promise<WalletAccount> => {
            if (!account.privateKey) {
                throw new Error(
                    'Pera Web account missing private_key after parse',
                )
            }
            return importFromSeed({
                address: account.address,
                privateKey: account.privateKey,
                name: account.name,
            })
        },
        [importFromSeed],
    )

    return { importAccount }
}
