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
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    resolveMinFeeForSender,
    useFeeConfig,
    useSuggestedMinFeeQuery,
} from '@perawallet/wallet-core-signing'
import { sendFlowChainAdapters, sendFlowFeatureFor } from '../chain-adapter'

import type { Decimal } from 'decimal.js'

export type UseDelegationTransactionFeeQueryResult = {
    /** Fee the delegation transaction will actually pay, in display units of the chain's native asset. */
    fee: Decimal | undefined
    isPending: boolean
}

/**
 * Resolves the fee a delegation transaction will pay by building the actual
 * transaction and reading the fee the chain sized for it. Building the real
 * transaction, rather than estimating from a byte-count constant, keeps the
 * displayed fee correct under network congestion and in lockstep with what
 * `useSubmitDelegationMutation` submits.
 *
 * The rekey transaction is signed by `sourceAddress`'s CURRENT auth account
 * (pre-rekey), so `resolveMinFeeForSender`'s `getSignerFor` resolution is the
 * correct fee basis — a sender currently rekeyed to a quantum auth pays the
 * PQ fee regardless of the rekey's direction. `resolveMinFeeForSender` owns the
 * network-congestion guard (`max(suggestedMinFee, configMinTxnFee)`).
 */
export const useDelegationTransactionFeeQuery = (
    sourceAddress: string,
    authorityAddress: string,
    scope: ChainScope,
): UseDelegationTransactionFeeQueryResult => {
    const accounts = useAllAccounts()
    const { minTxnFee, pqMultiplier } = useFeeConfig(scope.chainId)
    // Shared cached query instead of a private getSuggestedParams() fetch —
    // the send flow has usually populated it already.
    const {
        suggestedMinFee: loadedSuggestedMinFee,
        isError: isSuggestedMinFeeError,
    } = useSuggestedMinFeeQuery(scope.chainId)
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
            'delegation-transaction-fee',
            scope,
            sourceAddress,
            authorityAddress,
            String(suggestedMinFee),
        ],
        queryFn: async () => {
            // The rekey txn is signed by `sourceAddress`'s CURRENT auth
            // account (pre-rekey) — resolveMinFeeForSender resolves the
            // effective signer via getSignerFor, so a sender currently
            // rekeyed to a quantum auth (e.g. mid undo-rekey) correctly pays
            // the PQ fee. The max(suggested, config) congestion guard also
            // lives there.
            const resolvedMinFee = resolveMinFeeForSender(scope.chainId, {
                senderAddress: sourceAddress,
                accounts,
                suggestedMinFee: suggestedMinFee!,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            // Built through the same adapter call the submit mutation uses,
            // so the fee shown is the fee paid.
            const txn = await sendFlowFeatureFor(scope, 'delegation').buildTx({
                scope,
                sourceAddress,
                authorityAddress,
                minFee: resolvedMinFee,
            })
            return baseUnitsToDisplayUnits(
                sendFlowChainAdapters.get(scope.chainId).transactionFee(txn),
                getChainDescriptor(scope.chainId).nativeAsset.decimals,
            )
        },
        enabled:
            !!sourceAddress && !!authorityAddress && suggestedMinFee !== null,
    })

    return {
        fee: query.data,
        isPending: query.isPending,
    }
}
