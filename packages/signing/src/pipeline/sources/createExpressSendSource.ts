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

import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { DataSource } from '../types'
import { createLocalSource } from './factories'
import type { ExpressSendSourceParams, SourceDependencies } from './types'

/**
 * Create an express send source that handles:
 * 1. (Optional) Funding payment if receiver needs ALGO for MBR
 * 2. Asset opt-in for the receiver (signed by receiver)
 * 3. Asset transfer from sender to receiver
 *
 * @param deps - Dependencies for building transactions
 * @returns A DataSource that builds express send transaction groups
 *
 * @example
 * const source = createExpressSendSource(deps)
 * const group = await source.getSignableData({
 *   sender: 'ABC...',
 *   receiver: 'XYZ...',
 *   amount: 100n,
 *   assetId: 123456n,
 * })
 */
export const createExpressSendSource = (
    deps: Pick<
        SourceDependencies,
        | 'createPaymentTransaction'
        | 'createAssetTransferTransaction'
        | 'createAssetOptInTransaction'
        | 'encodeTransaction'
        | 'getAccountInfo'
        | 'resolveMinFeeForSender'
        | 'assetMbr'
    >,
): DataSource<ExpressSendSourceParams> => {
    const {
        createPaymentTransaction,
        createAssetTransferTransaction,
        createAssetOptInTransaction,
        encodeTransaction,
        getAccountInfo,
        resolveMinFeeForSender,
        assetMbr,
    } = deps

    return createLocalSource<ExpressSendSourceParams>(async params => {
        const { sender, receiver, amount, assetId } = params

        // Look up receiver's current balance to determine funding needed
        const { amount: currentBalance, minBalance: currentMbr } =
            await getAccountInfo(receiver)

        const senderFee = await resolveMinFeeForSender(sender)
        const receiverFee = await resolveMinFeeForSender(receiver)

        // After opt-in the receiver's MBR increases by ASSET_MBR.
        // The opt-in tx fee is paid from the receiver's balance at the
        // receiver's own (PQ-aware) rate, so reserve exactly that.
        const mbrAfterOptIn = currentMbr + assetMbr
        const balanceNeeded = mbrAfterOptIn + receiverFee
        const fundingNeeded =
            balanceNeeded > currentBalance ? balanceNeeded - currentBalance : 0n

        const transactions: PeraTransaction[] = []
        // Track which transactions the sender signs
        // The opt-in is signed by the receiver, not the sender
        const senderIndicesToSign: number[] = []

        // Add funding payment if needed
        if (fundingNeeded > 0n) {
            const fundingTx = await createPaymentTransaction({
                sender,
                receiver,
                amount: fundingNeeded,
                fee: senderFee,
            })
            senderIndicesToSign.push(transactions.length)
            transactions.push(fundingTx)
        }

        // Add opt-in transaction (signed by receiver)
        const optInTx = await createAssetOptInTransaction({
            sender: receiver,
            assetId,
            fee: receiverFee,
        })
        // Note: opt-in is NOT in senderIndicesToSign - it's signed by receiver
        transactions.push(optInTx)

        // Add transfer transaction
        const transferTx = await createAssetTransferTransaction({
            sender,
            receiver,
            amount,
            assetId,
            fee: senderFee,
        })
        senderIndicesToSign.push(transactions.length)
        transactions.push(transferTx)

        // Encode all transactions
        const rawTransactionsBase64 = transactions.map(tx =>
            encodeToBase64(encodeTransaction(tx)),
        )

        return {
            data: {
                type: 'transactions',
                transactions,
                rawTransactionsBase64,
                indicesToSign: senderIndicesToSign,
            },
            signerAddress: sender,
        }
    })
}
