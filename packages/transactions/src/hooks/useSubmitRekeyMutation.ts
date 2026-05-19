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

import { useMutation } from '@tanstack/react-query'

import {
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    submitAndAutoRefresh,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { RekeyError } from '../errors'
import { requestRekeySignatures } from './requestRekeySignatures'

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

export type SubmitRekeyParams = {
    /** Sender / receiver of the 0-amount payment that carries the rekey. */
    sourceAddress: string
    /** Address that will become the new auth address. */
    rekeyToAddress: string
}

export type UseSubmitRekeyMutationOptions = {
    /**
     * Localized strings shown in the signing pipeline's review UI. The
     * hook lives in a package and intentionally doesn't know about app
     * i18n — callers pass already-localized values.
     */
    signingMetadata: {
        name: string
        description: string
    }
}

export type UseSubmitRekeyMutationResult = {
    submitAsync: (params: SubmitRekeyParams) => Promise<string[]>
    isPending: boolean
}

/**
 * End-to-end submit for a rekey transaction:
 * 1. Build an unsigned 0-amount payment with `rekeyTo`.
 * 2. Hand it to the signing pipeline so the canonical Ledger approval UI
 *    can surface when the source's auth chain ends at a hardware account.
 * 3. Submit via `submitAndAutoRefresh` so the source account's balance and
 *    auth state are refreshed once algod accepts — otherwise the success
 *    screen would render against a stale `rekeyAddress` until periodic sync.
 *    Return the resulting tx IDs.
 *
 * Every failure propagates as a {@link RekeyError} tagged with the stage
 * that failed (`build_failed`, `signing_failed`, `submission_failed`,
 * `user_rejected`) so confirm screens can show failure-specific copy.
 */
export const useSubmitRekeyMutation = ({
    signingMetadata,
}: UseSubmitRekeyMutationOptions): UseSubmitRekeyMutationResult => {
    const algokit = useAlgorandClient()
    const { addSignRequest } = useSigningRequest()
    const { encodeSignedTransactions } = useTransactionEncoder()

    const mutation = useMutation({
        // The global default mutation config sets throwOnError: true so that
        // unhandled mutation errors surface to the nearest ErrorBoundary. All
        // callers of this hook (rekey-to-standard, rekey-to-ledger,
        // rekey-to-shared, undo-rekey confirm screens) wrap submitAsync in a
        // try/catch that surfaces errors via showError/showToast, so we opt
        // out — otherwise a Ledger timeout or signing failure would re-throw
        // on the next render (TanStack Query keeps mutation.error populated
        // until reset()), crashing the confirm screen into a Render Error
        // overlay after the toast had already been shown.
        throwOnError: false,
        mutationFn: async ({
            sourceAddress,
            rekeyToAddress,
        }: SubmitRekeyParams): Promise<string[]> => {
            let unsignedTxn: PeraTransaction
            try {
                // No explicit fee — AlgoKit sizes it from the full encoded
                // transaction (`max(minFee, feePerByte × size)`), so the
                // rekey never underpays under congestion.
                unsignedTxn = await algokit.createTransaction.payment({
                    sender: sourceAddress,
                    receiver: sourceAddress,
                    amount: 0n.microAlgo(),
                    rekeyTo: rekeyToAddress,
                })
            } catch (error) {
                throw new RekeyError('build_failed', error)
            }

            // requestRekeySignatures already rejects with a RekeyError
            // (`user_rejected` / `signing_failed`), so it is not re-wrapped.
            const signed = await requestRekeySignatures(
                addSignRequest,
                signingMetadata,
                [unsignedTxn],
            )

            try {
                return await submitAndAutoRefresh(
                    algokit,
                    encodeSignedTransactions,
                    signed,
                )
            } catch (error) {
                throw new RekeyError('submission_failed', error)
            }
        },
    })

    return {
        submitAsync: mutation.mutateAsync,
        isPending: mutation.isPending,
    }
}
