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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { TransactionWarning } from '../models'

export const aggregateTransactionWarnings = (
    transactions: PeraDisplayableTransaction[],
    userAccountAddresses: Set<string>,
    signableAddresses: Set<string>,
    // Maps a transaction's index → the authorizing address (the dApp-supplied
    // ARC-0001 signer override). When set, gating keys off this entity instead
    // of `tx.sender` so the warning logic agrees with the signing decision,
    // which also signs as `signerOverride ?? tx.sender`. Keys index into
    // `transactions`. [PERA-4417]
    authorizerByIndex?: Map<number, string>,
): TransactionWarning[] => {
    const warnings: TransactionWarning[] = []

    for (const [index, tx] of transactions.entries()) {
        if (!tx.sender) {
            continue
        }

        // The account that actually authorizes the transaction — the override
        // when the dApp supplied one, otherwise the sender. `senderAddress` in
        // each warning stays `tx.sender`: that's the account being
        // rekeyed/closed/frozen on-chain, regardless of who signs for it.
        const authorizer = authorizerByIndex?.get(index) ?? tx.sender

        if (userAccountAddresses.has(authorizer)) {
            if (tx.paymentTransaction?.closeRemainderTo) {
                warnings.push({
                    type: 'close-account',
                    senderAddress: tx.sender,
                    targetAddress: tx.paymentTransaction.closeRemainderTo,
                })
            }

            if (tx.assetTransferTransaction?.closeTo) {
                warnings.push({
                    type: 'close-asset',
                    senderAddress: tx.sender,
                    targetAddress: tx.assetTransferTransaction.closeTo,
                })
            }

            if (tx.assetFreezeTransaction) {
                warnings.push({
                    type: 'asset-freeze',
                    senderAddress: tx.sender,
                    targetAddress: tx.assetFreezeTransaction.address,
                })
            }
        }

        // Gate rekey on signability, not mere ownership: only flag rekeys the
        // wallet can actually sign for (standard, ledger,
        // multisig-with-local-participant). Watch-only accounts and dApp
        // escrow/contract accounts (Folks Finance, Tinyman) are excluded. [PERA-4348]
        if (signableAddresses.has(authorizer) && tx.rekeyTo?.publicKey) {
            const rekeyAddress = encodeAlgorandAddress(tx.rekeyTo.publicKey)
            warnings.push({
                type: 'rekey',
                senderAddress: tx.sender,
                targetAddress: rekeyAddress,
            })
        }
    }

    return warnings
}
