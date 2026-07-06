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

import { useQuery } from '@tanstack/react-query'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    MIN_TXN_FEE,
    microAlgosToAlgos,
    useAlgorandClient,
    useMinimumFeeConfig,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { resolveMinFeeForSender } from '@perawallet/wallet-core-signing'

import type { Decimal } from 'decimal.js'

export type UseRekeyTransactionFeeQueryResult = {
    /** Fee the rekey transaction will actually pay, in ALGO. */
    feeAlgos: Decimal | undefined
    isPending: boolean
}

/**
 * Resolves the fee a rekey transaction will pay by building the actual
 * transaction and reading the fee AlgoKit sized for it
 * (`max(minFee, feePerByte × encodedSize)`). Building the real transaction —
 * rather than estimating from a byte-count constant — keeps the displayed
 * fee correct under network congestion and in lockstep with what
 * `useSubmitRekeyMutation` submits.
 *
 * The rekey transaction is signed by `sourceAddress`'s CURRENT auth account
 * (pre-rekey), so `resolveMinFeeForSender`'s `getSignerFor` resolution is the
 * correct fee basis — a sender currently rekeyed to a quantum auth pays the
 * PQ fee regardless of the rekey's direction. The result is never allowed to
 * fall below AlgoKit's auto-sized fee, and `resolveMinFeeForSender` owns the
 * network-congestion guard (`max(suggestedMinFee, configMinTxnFee)`).
 */
export const useRekeyTransactionFeeQuery = (
    sourceAddress: string,
    rekeyToAddress: string,
): UseRekeyTransactionFeeQueryResult => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const accounts = useAllAccounts()
    const { minTxnFee, pqMultiplier } = useMinimumFeeConfig()

    const query = useQuery({
        // Network is part of the key — feePerByte differs between mainnet
        // and testnet, so a cached fee from one must not satisfy the other.
        queryKey: [
            'rekey-transaction-fee',
            network,
            sourceAddress,
            rekeyToAddress,
        ],
        queryFn: async () => {
            const [txn, suggestedParams] = await Promise.all([
                algokit.createTransaction.payment({
                    sender: sourceAddress,
                    receiver: sourceAddress,
                    amount: 0n.microAlgo(),
                    rekeyTo: rekeyToAddress,
                }),
                algokit.getSuggestedParams(),
            ])
            // AlgoKit populates `fee` when it builds the transaction; fall
            // back to the network minimum only to satisfy the optional type.
            const builtFee = txn.fee ?? MIN_TXN_FEE
            // The rekey txn is signed by `sourceAddress`'s CURRENT auth
            // account (pre-rekey) — resolveMinFeeForSender resolves the
            // effective signer via getSignerFor, so a sender currently
            // rekeyed to a quantum auth (e.g. mid undo-rekey) correctly pays
            // the PQ fee. The max(suggested, config) congestion guard also
            // lives there. Never let the displayed fee fall below what
            // useSubmitRekeyMutation will actually pay.
            const resolvedMinFee = resolveMinFeeForSender({
                senderAddress: sourceAddress,
                accounts,
                suggestedMinFee: BigInt(suggestedParams.minFee),
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
            return microAlgosToAlgos(
                resolvedMinFee > builtFee ? resolvedMinFee : builtFee,
            )
        },
        enabled: !!sourceAddress && !!rekeyToAddress,
    })

    return {
        feeAlgos: query.data,
        isPending: query.isPending,
    }
}
