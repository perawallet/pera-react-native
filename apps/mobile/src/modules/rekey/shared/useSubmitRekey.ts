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

import { useCallback } from 'react'

import {
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    submitSignedTransactionGroup,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { requestRekeySignatures } from './requestRekeySignatures'

export type SubmitRekeyParams = {
    /** Sender / receiver of the 0-amount payment that carries the rekey. */
    sourceAddress: string
    /** Address that will become the new auth address. */
    rekeyToAddress: string
}

export type UseSubmitRekeyResult = {
    submitRekey: (params: SubmitRekeyParams) => Promise<string[]>
}

/**
 * End-to-end submit for a rekey transaction:
 * 1. Build an unsigned 0-amount payment with `rekeyTo`.
 * 2. Hand it to the signing pipeline so the canonical Ledger approval UI
 *    can surface when the source's auth chain ends at a hardware account.
 * 3. Submit the signed bytes to algod and return the resulting tx IDs.
 *
 * Cancellations propagate as {@link RekeyUserRejectedError}; pipeline
 * errors propagate as their original Error so callers can map them to
 * user-facing copy.
 */
export const useSubmitRekey = (): UseSubmitRekeyResult => {
    const { t } = useLanguage()
    const algokit = useAlgorandClient()
    const { addSignRequest } = useSigningRequest()
    const { encodeSignedTransactions } = useTransactionEncoder()

    const submitRekey = useCallback(
        async ({
            sourceAddress,
            rekeyToAddress,
        }: SubmitRekeyParams): Promise<string[]> => {
            const unsignedTxn = await algokit.createTransaction.payment({
                sender: sourceAddress,
                receiver: sourceAddress,
                amount: 0n.microAlgo(),
                rekeyTo: rekeyToAddress,
            })

            const signed = await requestRekeySignatures(
                addSignRequest,
                {
                    name: t('rekey.signing.source_name'),
                    description: t('rekey.signing.source_description'),
                },
                [unsignedTxn],
            )

            return submitSignedTransactionGroup(
                algokit,
                encodeSignedTransactions,
                signed,
            )
        },
        [algokit, addSignRequest, encodeSignedTransactions, t],
    )

    return { submitRekey }
}
