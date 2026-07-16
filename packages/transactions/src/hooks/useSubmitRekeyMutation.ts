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

import { useMutation } from '@tanstack/react-query'

import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useAlgorandClient,
    useMinimumFeeConfig,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    resolveMinFeeForSender,
    submitAndAutoRefresh,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { RekeyError } from '../errors'
import { effectiveRekeyFee } from './effectiveRekeyFee'
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
 *
 * The rekey transaction is signed by `sourceAddress`'s CURRENT auth account
 * (pre-rekey), so `resolveMinFeeForSender`'s `getSignerFor` resolution is the
 * correct fee basis — a sender currently rekeyed to a quantum auth (e.g.
 * mid undo-rekey) pays the PQ fee regardless of the rekey's direction. The
 * network-congestion guard (`max(suggestedMinFee, configMinTxnFee)`) lives
 * in `resolveMinFeeForSender` too.
 */
export const useSubmitRekeyMutation = ({
    signingMetadata,
}: UseSubmitRekeyMutationOptions): UseSubmitRekeyMutationResult => {
    const algokit = useAlgorandClient()
    const { addSignRequest } = useSigningRequest()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const accounts = useAllAccounts()
    const { minTxnFee, pqMultiplier } = useMinimumFeeConfig()

    const mutation = useMutation({
        // `mutationDefaults` (@perawallet/wallet-core-shared) already sets
        // throwOnError: false. This explicit override is kept as a load-bearing
        // reminder: every caller (rekey-to-standard/-ledger/-shared, undo-rekey
        // confirm screens) wraps submitAsync in a try/catch that surfaces errors
        // via showError/showToast. A re-throw on the next render (TanStack keeps
        // mutation.error populated until reset()) would crash the confirm screen
        // into a Render Error overlay after the toast had already been shown.
        throwOnError: false,
        mutationFn: async ({
            sourceAddress,
            rekeyToAddress,
        }: SubmitRekeyParams): Promise<string[]> => {
            let unsignedTxn: PeraTransaction
            try {
                // OFF-004: fail fast offline BEFORE the signing pipeline opens
                // (no Ledger prompt / no biometric on a request that can't be
                // submitted). Surfaces through the existing build_failed path.
                assertOnline()
                const suggestedParams = await algokit.getSuggestedParams()
                const suggestedMinFee = BigInt(suggestedParams.minFee)
                // The rekey txn is signed by sourceAddress's CURRENT auth
                // (pre-rekey) — resolveMinFeeForSender resolves the
                // effective signer via getSignerFor, so this is the correct
                // fee basis even when undoing a rekey to a quantum auth.
                const resolvedMinFee = resolveMinFeeForSender({
                    senderAddress: sourceAddress,
                    accounts,
                    suggestedMinFee,
                    configMinTxnFee: minTxnFee,
                    pqMultiplier,
                })
                const draft = await algokit.createTransaction.payment({
                    sender: sourceAddress,
                    receiver: sourceAddress,
                    amount: 0n.microAlgo(),
                    rekeyTo: rekeyToAddress,
                })
                // AlgoKit populates `fee` when it builds the transaction;
                // fall back to the network minimum only to satisfy the
                // optional type. Mirrors useRekeyTransactionFeeQuery.
                const builtFee = draft.fee ?? minTxnFee
                const targetFee = effectiveRekeyFee(resolvedMinFee, builtFee)
                // Rebuild with an explicit fee only when the PQ-aware minimum
                // exceeds what AlgoKit auto-sized from the encoded size — an
                // override below the auto-sized fee could underpay under
                // per-byte congestion pricing.
                unsignedTxn =
                    targetFee > builtFee
                        ? await algokit.createTransaction.payment({
                              sender: sourceAddress,
                              receiver: sourceAddress,
                              amount: 0n.microAlgo(),
                              rekeyTo: rekeyToAddress,
                              staticFee: targetFee.microAlgo(),
                          })
                        : draft
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
