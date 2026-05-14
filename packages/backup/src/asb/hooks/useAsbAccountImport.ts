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
import { mnemonicFromSeed } from '@algorandfoundation/algokit-utils/algo25'
import {
    AccountTypes,
    DuplicateAccountError,
    useAccountsStore,
    useImportAccount,
    useUpdateAccount,
    type WalletAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { useMarkMnemonicBackupComplete } from '../../mnemonic'
import { AsbAccountKind, type AsbBackupAccount } from '../models'

// Single accounts (= algo25) encode the 64-byte tweetnacl secret key
// (seed || pubKey). Take the seed half and let the KMS rebuild the keypair
// through the regular import path so duplicate detection, keystore commits,
// and backend sync stay in one place.
const ALGO25_SEED_LENGTH = 32

/**
 * Return a *copy* of the first 32 bytes of `privateKey`. A `subarray` would
 * share memory with the caller's buffer, so zeroing our local view post-import
 * would wipe `account.privateKey` underneath them. The slice cost is 32 bytes
 * and we get a buffer we can wipe freely in `finally`.
 */
const seedFromAsbPrivateKey = (privateKey: Uint8Array): Uint8Array => {
    if (privateKey.length < ALGO25_SEED_LENGTH) {
        throw new Error('ASB single-account private_key shorter than 32 bytes')
    }
    return privateKey.slice(0, ALGO25_SEED_LENGTH)
}

export type UseAsbAccountImportResult = {
    importAccount: (account: AsbBackupAccount) => Promise<WalletAccount>
}

/**
 * Import a single account decrypted from an ARC-35 backup into the wallet.
 *
 * - `single` (algo25): rebuild a 25-word Algorand mnemonic from the seed and
 *   feed it through the standard `useImportAccount` so duplicate detection
 *   and key persistence go through one code path. The imported account is
 *   automatically marked as backed-up — by definition it was, into ASB.
 * - `watch`: persist directly via the accounts store, mirroring
 *   `useWatchAccountScreen`.
 *
 * Callers loop this for each user-selected account; failures from one row
 * surface to the caller without aborting the others. `DuplicateAccountError`
 * is re-thrown for the caller to bucket separately.
 */
export const useAsbAccountImport = (): UseAsbAccountImportResult => {
    const importAlgo25 = useImportAccount()
    const updateAccount = useUpdateAccount()
    const markBackupComplete = useMarkMnemonicBackupComplete()
    // Watch-account writes read+write the accounts store inside a loop the
    // caller drives (see `useAsbImportSelectAccountsScreen.handleContinue`).
    // Using the hook-subscribed `accounts` would close over the render's
    // snapshot, so back-to-back watch imports — or a watch following an
    // algo25 mint — would clobber whichever write came first. Pull the
    // latest list from the store inside `importAccount` instead.
    const setAccounts = useAccountsStore(state => state.setAccounts)

    const importAccount = useCallback(
        async (account: AsbBackupAccount): Promise<WalletAccount> => {
            if (!isValidAlgorandAddress(account.address)) {
                throw new Error(`Invalid Algorand address: ${account.address}`)
            }

            if (account.kind === AsbAccountKind.Single) {
                if (!account.privateKey) {
                    throw new Error(
                        'ASB single account missing private_key after parse',
                    )
                }

                // Take a copy of the seed so we can zero our local buffer
                // without disturbing `account.privateKey` (the caller still
                // owns it). The 25-word `mnemonic` string is unfortunately
                // unwipable — it lives on the JS heap until GC.
                const seed = seedFromAsbPrivateKey(account.privateKey)
                try {
                    const mnemonic = mnemonicFromSeed(seed)
                    const imported = await importAlgo25({
                        mnemonic,
                        type: 'algo25',
                    })

                    // `useImportAccount` returns `ImportHDPendingResult` only
                    // for hdWallet imports. Algo25 imports always return a
                    // WalletAccount.
                    if (!('address' in imported)) {
                        throw new Error(
                            'Unexpected non-account result for algo25 ASB import',
                        )
                    }

                    const renamed: WalletAccount = account.name
                        ? { ...imported, name: account.name }
                        : imported

                    if (account.name) {
                        updateAccount(renamed)
                    }

                    markBackupComplete(renamed)
                    return renamed
                } finally {
                    zeroBytes(seed)
                }
            }

            // Watch path: no KMS interaction, just append to the store.
            // Mirror useWatchAccountScreen's hand-built WatchAccount shape.
            // Read from the live store rather than a hook-snapshot — the
            // caller imports accounts in a loop and we must see writes from
            // the previous iteration.
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
        [importAlgo25, updateAccount, markBackupComplete, setAccounts],
    )

    return { importAccount }
}
