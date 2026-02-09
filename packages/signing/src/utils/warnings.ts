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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { TransactionWarning } from '../models'

export const aggregateTransactionWarnings = (
    transactions: PeraDisplayableTransaction[],
    signableAddresses: Set<string>,
): TransactionWarning[] => {
    const warnings: TransactionWarning[] = []

    for (const tx of transactions) {
        if (!tx.sender || !signableAddresses.has(tx.sender)) {
            continue
        }

        const closeAddress =
            tx.paymentTransaction?.closeRemainderTo ??
            tx.assetTransferTransaction?.closeTo

        if (closeAddress) {
            warnings.push({
                type: 'close',
                senderAddress: tx.sender,
                targetAddress: closeAddress,
            })
        }

        if (tx.rekeyTo?.publicKey) {
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
