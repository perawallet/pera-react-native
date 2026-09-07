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
import {
    useImportAccount,
    useUpdateAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    ALGO25_SEED_LENGTH,
    algo25SeedToIndices,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { useMarkMnemonicBackupComplete } from '../mnemonic'

/**
 * Copy the first 32 bytes off `privateKey` so the caller's buffer is left
 * intact. `subarray` would share memory and our `finally` `zeroBytes(seed)`
 * would wipe `account.privateKey` underneath the caller.
 */
const sliceSeed = (privateKey: Uint8Array): Uint8Array => {
    if (privateKey.length < ALGO25_SEED_LENGTH) {
        throw new Error(
            `Algo25 private_key shorter than ${ALGO25_SEED_LENGTH} bytes`,
        )
    }
    return privateKey.slice(0, ALGO25_SEED_LENGTH)
}

export type UseImportAlgo25FromSeedResult = {
    importFromSeed: (params: {
        /** Encoded Algorand address — validated before any keystore work. */
        address: string
        /** 32- or 64-byte private key from the backup. */
        privateKey: Uint8Array
        /** Optional user-supplied account name; persisted post-import. */
        name?: string | null
    }) => Promise<WalletAccount>
}

/**
 * Import a single algo25 account given its raw seed bytes. Used by both the
 * ASB and Pera Web import flows for `single`-kind accounts.
 *
 * Approach: rebuild the 25 wordlist indices from the seed via
 * `algo25SeedToIndices` and feed them through the standard `useImportAccount`
 * so duplicate detection, keystore commits, backend device-sync, and
 * mark-as-backed-up all stay in one code path. Both legacy callers do the
 * same dance — `useAsbAccountImport` (Single kind) and
 * `usePeraWebAccountImport` — so the shared hook absorbs the round-trip,
 * the defensive seed copy, and the zeroize-in-finally lifecycle.
 *
 * Security: the seed bytes and the index buffer live only for the duration
 * of the import and are wiped in `finally`; the phrase never exists as a
 * string on this path.
 *
 * `DuplicateAccountError` from the underlying import path is re-thrown so
 * the caller (the loading / select-accounts screen) can bucket duplicates
 * separately from real failures.
 */
export const useImportAlgo25FromSeed = (): UseImportAlgo25FromSeedResult => {
    const importAlgo25 = useImportAccount()
    const updateAccount = useUpdateAccount()
    const markBackupComplete = useMarkMnemonicBackupComplete()

    const importFromSeed = useCallback(
        async (params: {
            address: string
            privateKey: Uint8Array
            name?: string | null
        }): Promise<WalletAccount> => {
            if (!isValidAlgorandAddress(params.address)) {
                throw new Error(`Invalid Algorand address: ${params.address}`)
            }

            const seed = sliceSeed(params.privateKey)
            let mnemonicIndices: Uint16Array | null = null
            try {
                mnemonicIndices = algo25SeedToIndices(seed)
                const imported = await importAlgo25({
                    mnemonicIndices,
                    type: 'algo25',
                })

                // Algo25 imports always return a WalletAccount; the HD
                // branch only fires for `type: 'hdWallet'`.
                if (!('address' in imported)) {
                    throw new Error(
                        'Unexpected non-account result for algo25 seed import',
                    )
                }

                const renamed: WalletAccount = params.name
                    ? { ...imported, name: params.name }
                    : imported

                if (params.name) {
                    updateAccount(renamed)
                }

                markBackupComplete(renamed)
                return renamed
            } finally {
                zeroBytes(seed, mnemonicIndices)
            }
        },
        [importAlgo25, updateAccount, markBackupComplete],
    )

    return { importFromSeed }
}
