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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useMnemonicBackupStore } from '../store'
import { getMnemonicBackupKeyId } from '../utils'

// Returns true only when the account owns a mnemonic-backup key and that key
// has not yet been marked backed up. Accounts without a recovery-phrase concept
// (watch, hardware, multisig) and already-backed-up accounts both return
// false, so consumers don't have to re-check the account type themselves.
export const useRequiresMnemonicBackup = (
    account: WalletAccount | null | undefined,
): boolean => {
    const backedUpKeyIds = useMnemonicBackupStore(state => state.backedUpKeyIds)

    if (!account) return false

    const keyId = getMnemonicBackupKeyId(account)
    if (keyId === null) return false

    return !backedUpKeyIds[keyId]
}
