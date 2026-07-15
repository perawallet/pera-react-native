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
    isQuantumAccount,
    resolveAuthAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

/**
 * True if any transaction in the group is authorized by a quantum (Falcon)
 * account. Mirrors the signing pipeline's signer resolution: for each txn,
 * map its sender to a wallet account, follow one rekey hop via
 * resolveAuthAccount, and test isQuantumAccount. A sender not held in the
 * wallet, or a rekey target missing from the store, is treated as
 * non-quantum. Never parses signature bytes; never reads the remote-config
 * flag — it must protect ALL quantum submissions during the mock phase.
 */
export const containsQuantumSigner = (
    transactions: readonly PeraTransaction[],
    accounts: readonly WalletAccount[],
): boolean =>
    transactions.some(tx => {
        const sender = tx.sender?.toString()
        if (!sender) return false
        const senderAccount = accounts.find(a => a.address === sender)
        if (!senderAccount) return false
        try {
            return isQuantumAccount(
                resolveAuthAccount(senderAccount, [...accounts]),
            )
        } catch {
            return false
        }
    })
