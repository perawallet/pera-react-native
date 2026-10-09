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

import {
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

export const getMnemonicBackupKeyId = (
    account: WalletAccount,
): string | null => {
    if (
        isAlgo25Account(account) ||
        isHDWalletAccount(account) ||
        isQuantumAccount(account)
    ) {
        // All accounts derived from the same wallet root share a single
        // backup state, keyed on the root id (keyPairId). Quantum accounts
        // export the same 25-word (algo25 wire format) recovery phrase, so
        // they back up through the identical key-scoped state.
        return account.keyPairId
    }
    return null
}
