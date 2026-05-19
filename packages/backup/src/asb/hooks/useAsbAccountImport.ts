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

import { useCallback } from 'react'
import {
    AccountTypes,
    DuplicateAccountError,
    useAccountsStore,
    type WalletAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { useImportAlgo25FromSeed } from '../../shared'
import { AsbAccountKind, type AsbBackupAccount } from '../models'

export type UseAsbAccountImportResult = {
    importAccount: (account: AsbBackupAccount) => Promise<WalletAccount>
}

/**
 * Import a single account decrypted from an ARC-35 backup into the wallet.
 *
 * - `single` (algo25): delegates to `useImportAlgo25FromSeed`, which
 *   rebuilds a 25-word mnemonic from the seed and feeds it through the
 *   standard import path. Shared with the Pera Web flow.
 * - `watch`: persist directly via the accounts store, mirroring
 *   `useWatchAccountScreen`.
 *
 * Callers loop this for each user-selected account; failures from one row
 * surface to the caller without aborting the others. `DuplicateAccountError`
 * is re-thrown for the caller to bucket separately.
 */
export const useAsbAccountImport = (): UseAsbAccountImportResult => {
    const { importFromSeed } = useImportAlgo25FromSeed()
    // Watch-account writes read+write the accounts store inside a loop the
    // caller drives (see `useAsbImportSelectAccountsScreen.handleContinue`).
    // Using the hook-subscribed `accounts` would close over the render's
    // snapshot, so back-to-back watch imports — or a watch following an
    // algo25 mint — would clobber whichever write came first. Pull the
    // latest list from the store inside `importAccount` instead.
    const setAccounts = useAccountsStore(state => state.setAccounts)

    const importAccount = useCallback(
        async (account: AsbBackupAccount): Promise<WalletAccount> => {
            if (account.kind === AsbAccountKind.Single) {
                if (!account.privateKey) {
                    throw new Error(
                        'ASB single account missing private_key after parse',
                    )
                }
                return importFromSeed({
                    address: account.address,
                    privateKey: account.privateKey,
                    name: account.name,
                })
            }

            // Watch path: no KMS interaction, just append to the store.
            // Mirror useWatchAccountScreen's hand-built WatchAccount shape.
            // Read from the live store rather than a hook-snapshot — the
            // caller imports accounts in a loop and we must see writes from
            // the previous iteration.
            if (!isValidAlgorandAddress(account.address)) {
                throw new Error(`Invalid Algorand address: ${account.address}`)
            }
            const currentAccounts = useAccountsStore.getState().accounts
            const isDuplicate = currentAccounts.some(
                a => a.address === account.address,
            )
            if (isDuplicate) {
                throw new DuplicateAccountError(account.address)
            }

            const newWatch: WatchAccount = {
                id: generateOrderedUniqueId(),
                address: account.address,
                type: AccountTypes.watch,
                ...(account.name ? { name: account.name } : {}),
            }

            setAccounts([...currentAccounts, newWatch])
            return newWatch
        },
        [importFromSeed, setAccounts],
    )

    return { importAccount }
}
