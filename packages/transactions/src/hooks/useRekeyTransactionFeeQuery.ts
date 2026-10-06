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

import { useQuery } from '@tanstack/react-query'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { microAlgosToAlgos } from '@perawallet/wallet-core-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    resolveMinFeeForSender,
    useFeeConfig,
    useSuggestedMinFeeQuery,
} from '@perawallet/wallet-core-signing'
import { sendFlowFeatureFor } from '../chain-adapter'

import type { Decimal } from 'decimal.js'

export type UseRekeyTransactionFeeQueryResult = {
    /** Fee the rekey transaction will actually pay, in ALGO. */
    feeAlgos: Decimal | undefined
    isPending: boolean
}

/**
 * Resolves the fee a rekey transaction will pay by building the actual
 * transaction and reading the fee the chain sized for it. Building the real
 * transaction, rather than estimating from a byte-count constant, keeps the
 * displayed fee correct under network congestion and in lockstep with what
 * `useSubmitRekeyMutation` submits.
 *
 * The rekey transaction is signed by `sourceAddress`'s CURRENT auth account
 * (pre-rekey), so `resolveMinFeeForSender`'s `getSignerFor` resolution is the
 * correct fee basis — a sender currently rekeyed to a quantum auth pays the
 * PQ fee regardless of the rekey's direction. `resolveMinFeeForSender` owns the
 * network-congestion guard (`max(suggestedMinFee, configMinTxnFee)`).
 */
export const useRekeyTransactionFeeQuery = (
    sourceAddress: string,
    rekeyToAddress: string,
): UseRekeyTransactionFeeQueryResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const accounts = useAllAccounts()
    const { minTxnFee, pqMultiplier } = useFeeConfig(LEGACY_CHAIN_ID)
    // Shared cached query instead of a private getSuggestedParams() fetch —
    // the send flow has usually populated it already.
    const {
        suggestedMinFee: loadedSuggestedMinFee,
        isError: isSuggestedMinFeeError,
    } = useSuggestedMinFeeQuery(LEGACY_CHAIN_ID)
    // Fall back to the config floor when the shared query errors (offline /
    // algod down — it fails fast, networkMode 'always'): staying disabled
    // would leave this query pending forever and the confirm CTA dead.
    // resolveMinFeeForSender already guards with max(suggested, config).
    const suggestedMinFee =
        loadedSuggestedMinFee !== undefined
            ? loadedSuggestedMinFee
            : isSuggestedMinFeeError
              ? minTxnFee
              : null

    const query = useQuery({
        // Scope is part of the key — feePerByte differs between mainnet
        // and testnet, so a cached fee from one must not satisfy the other.
        // suggestedMinFee too: the queryFn reads it from the closure, so a
        // refreshed value must produce a new cache entry.
        queryKey: [
            'rekey-transaction-fee',
            scope,
            sourceAddress,
            rekeyToAddress,
            String(suggestedMinFee),
        ],
        queryFn: async () => {
            // The rekey txn is signed by `sourceAddress`'s CURRENT auth
            // account (pre-rekey) — resolveMinFeeForSender resolves the
            // effective signer via getSignerFor, so a sender currently
            // rekeyed to a quantum auth (e.g. mid undo-rekey) correctly pays
            // the PQ fee. The max(suggested, config) congestion guard also
            // lives there.
            const resolvedMinFee = resolveMinFeeForSender({
                senderAddress: sourceAddress,
                accounts,
                suggestedMinFee: suggestedMinFee!,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            // Built through the same adapter call the submit mutation uses,
            // so the fee shown is the fee paid.
            const txn = await sendFlowFeatureFor(scope, 'rekey').buildTx({
                scope,
                sourceAddress,
                rekeyToAddress,
                minFee: resolvedMinFee,
            })
            return microAlgosToAlgos(txn.fee ?? resolvedMinFee)
        },
        enabled:
            !!sourceAddress && !!rekeyToAddress && suggestedMinFee !== null,
    })

    return {
        feeAlgos: query.data,
        isPending: query.isPending,
    }
}
