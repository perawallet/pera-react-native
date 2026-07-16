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
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { AsbBackupAccount } from '../models'

export type AsbImportablePartition = {
    importable: AsbBackupAccount[]
    alreadyImported: AsbBackupAccount[]
    unsupported: AsbBackupAccount[]
}

/**
 * Bucket the decrypted accounts into three lists driven by the wallet's
 * current state:
 *
 *  - `importable`     valid + not already present → user can choose to import
 *  - `alreadyImported` valid + matches an existing wallet account → shown in
 *                     the selection list but locked, mirroring iOS/Android
 *  - `unsupported`    invalid address → silently filtered (mirrors Android's
 *                     `AsbAccountImportParser` which drops these)
 *
 * Address comparison is exact; case sensitivity matches the on-disk format
 * since Algorand addresses are canonical base32.
 */
export const partitionImportableAccounts = (
    asbAccounts: AsbBackupAccount[],
    existingAccounts: WalletAccount[],
): AsbImportablePartition => {
    const existingAddresses = new Set(existingAccounts.map(a => a.address))

    const importable: AsbBackupAccount[] = []
    const alreadyImported: AsbBackupAccount[] = []
    const unsupported: AsbBackupAccount[] = []

    for (const account of asbAccounts) {
        if (!isValidAlgorandAddress(account.address)) {
            unsupported.push(account)
            continue
        }
        if (existingAddresses.has(account.address)) {
            alreadyImported.push(account)
            continue
        }
        importable.push(account)
    }

    return { importable, alreadyImported, unsupported }
}
