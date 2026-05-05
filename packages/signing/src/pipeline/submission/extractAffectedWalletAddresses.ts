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

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

type Stringable = { toString(): string }

const addAddress = (
    set: Set<string>,
    value: Stringable | null | undefined,
): void => {
    if (!value) return
    const str = value.toString()
    if (str) set.add(str)
}

/**
 * Returns the wallet-held addresses that participate in the given transaction
 * group as a balance-affecting party — sender on every txn, plus
 * receiver/closeRemainderTo for payments and receiver/assetSender (clawback)/
 * closeRemainderTo for asset transfers. Asset config / freeze / app call /
 * keyreg contribute only their sender.
 *
 * Used to drive a targeted balance refresh after broadcasting; addresses not
 * held in the wallet are filtered out so we never fetch on behalf of accounts
 * the user does not own.
 */
export const extractAffectedWalletAddresses = (
    transactions: readonly PeraTransaction[],
    walletAddresses: readonly string[],
): string[] => {
    if (walletAddresses.length === 0 || transactions.length === 0) return []

    const walletSet = new Set(walletAddresses)
    const candidates = new Set<string>()

    for (const tx of transactions) {
        addAddress(candidates, tx.sender)

        if (tx.payment) {
            addAddress(candidates, tx.payment.receiver)
            addAddress(candidates, tx.payment.closeRemainderTo)
        }

        if (tx.assetTransfer) {
            addAddress(candidates, tx.assetTransfer.receiver)
            addAddress(candidates, tx.assetTransfer.assetSender)
            addAddress(candidates, tx.assetTransfer.closeRemainderTo)
        }
    }

    return [...candidates].filter(addr => walletSet.has(addr))
}
