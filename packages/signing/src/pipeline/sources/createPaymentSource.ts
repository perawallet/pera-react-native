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

import { encodeToBase64, isAlgoAssetId } from '@perawallet/wallet-core-shared'
import type { DataSource } from '../types'
import { createLocalSource } from './factories'
import type { PaymentSourceParams, SourceDependencies } from './types'

/**
 * Create a payment source for ALGO or ASA transfers.
 *
 * @param deps - Dependencies for building transactions
 * @returns A DataSource that builds payment transactions
 *
 * @example
 * const source = createPaymentSource(deps)
 * const group = await source.getSignableData({
 *   sender: 'ABC...',
 *   receiver: 'XYZ...',
 *   amount: 1000000n,  // 1 ALGO
 * })
 */
export const createPaymentSource = (
    deps: Pick<
        SourceDependencies,
        | 'createPaymentTransaction'
        | 'createAssetTransferTransaction'
        | 'encodeTransaction'
        | 'resolveMinFeeForSender'
    >,
): DataSource<PaymentSourceParams> => {
    const {
        createPaymentTransaction,
        createAssetTransferTransaction,
        encodeTransaction,
        resolveMinFeeForSender,
    } = deps

    return createLocalSource<PaymentSourceParams>(async params => {
        const { sender, receiver, amount, assetId, note, isCloseAccount } =
            params

        const fee = await resolveMinFeeForSender(sender)

        // Determine if this is an ALGO payment or ASA transfer
        const isAlgoPayment = !assetId || isAlgoAssetId(assetId)

        let transaction

        if (isAlgoPayment) {
            transaction = await createPaymentTransaction({
                sender,
                receiver,
                // If closing account, amount is 0 and closeRemainderTo sends the rest
                amount: isCloseAccount ? 0n : amount,
                closeRemainderTo: isCloseAccount ? receiver : undefined,
                note,
                fee,
            })
        } else {
            transaction = await createAssetTransferTransaction({
                sender,
                receiver,
                amount,
                assetId,
                note,
                fee,
            })
        }

        const encoded = encodeTransaction(transaction)
        const base64 = encodeToBase64(encoded)

        return {
            data: {
                type: 'transactions',
                transactions: [transaction],
                rawTransactionsBase64: [base64],
                indicesToSign: [0],
            },
            signerAddress: sender,
        }
    })
}
