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

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
    decodeTransaction,
    encodeTransactionRaw,
    useAlgorandClient,
    useNetwork,
    type PeraDisplayableTransaction,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { flattenSimulatedInnerTransactions } from '../utils/simulateImpact'

/**
 * Clone a transaction with its group id cleared.
 *
 * dApp interactions (swaps, NFT purchases) arrive as an atomic group — every
 * transaction already carries a group id — but `composer.addTransaction` throws
 * on any transaction that is "already in a group". Without stripping it, the
 * simulation throws for every grouped request, the inner transactions are never
 * surfaced, and the balance impact shows only the spend side.
 *
 * We clone via the canonical encode/decode round-trip (never mutating the real
 * signing payload) and drop the group, letting the composer re-group the set
 * itself. The regrouped order matches the input, so the simulated execution —
 * and the inner transactions it produces — is equivalent.
 */
const ungroupForSimulation = (tx: PeraTransaction): PeraTransaction => {
    const clone = decodeTransaction(encodeTransactionRaw(tx))
    delete clone.group
    return clone
}

type UseGroupSimulationQueryParams = {
    /** Identifies the request for caching; the query is disabled without it. */
    requestId?: string
    /** Raw group to simulate (full group context, falling back to `txs`). */
    groupTxs?: PeraTransaction[]
    /** Caller-side gate — typically "the group contains an app call". */
    enabled?: boolean
}

/**
 * Runs an unsigned algod simulation of a transaction group and returns its
 * flattened inner transactions.
 *
 * App calls (swaps, lending, ASA factories, …) move funds through inner txns
 * the raw signing group never reveals; simulating surfaces them so balance
 * impact can account for dApp interactions. Best-effort: `retry: false` and a
 * caller-handled error mean a failure simply yields no inner txns rather than
 * blocking the flow.
 */
export const useGroupSimulationQuery = ({
    requestId,
    groupTxs,
    enabled = true,
}: UseGroupSimulationQueryParams): UseQueryResult<
    PeraDisplayableTransaction[],
    Error
> => {
    const algorand = useAlgorandClient()
    const { network } = useNetwork()

    return useQuery({
        queryKey: ['balance-impact-simulation', requestId, network],
        enabled: enabled && !!requestId && !!groupTxs?.length,
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
            const composer = algorand.newGroup()
            for (const tx of groupTxs ?? []) {
                composer.addTransaction(
                    tx.group ? ungroupForSimulation(tx) : tx,
                )
            }
            const { simulateResponse } = await composer.simulate({
                skipSignatures: true,
                allowUnnamedResources: true,
            })
            // Structurally compatible with the flattener's minimal view; cast
            // keeps us off the SDK's concrete model types.
            return flattenSimulatedInnerTransactions(
                simulateResponse as Parameters<
                    typeof flattenSimulatedInnerTransactions
                >[0],
            )
        },
    })
}
