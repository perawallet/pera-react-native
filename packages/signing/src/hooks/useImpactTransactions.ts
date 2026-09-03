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

import { useMemo } from 'react'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import type { TransactionSignRequest } from '../models'
import { useSigningPipeline } from './useSigningPipeline'
import { useGroupSimulationQuery } from './useGroupSimulationQuery'

type UseImpactTransactionsResult = {
    /** Top-level group plus any inner transactions surfaced by simulation. */
    transactions: PeraDisplayableTransaction[]
    signableAddresses: Set<string>
    isSimulating: boolean
    /**
     * Simulation was needed (the group has an app call) but failed, so the
     * inner transactions are missing and the computed impact is incomplete —
     * the spend side may be shown but the receive side is unknown. Consumers
     * should surface this rather than present a partial impact as complete.
     */
    simulationFailed: boolean
}

/**
 * The transaction set the balance impact is computed over.
 *
 * For plain transfers the decoded top-level group is complete. When the group
 * contains an app call, its real fund movements live in inner transactions that
 * only appear once the group is simulated — so we run an unsigned algod
 * simulation and append the flattened inner txns. Simulation is best-effort:
 * any failure falls back to the top-level group so the sheet never blocks on it.
 */
export const useImpactTransactions = (): UseImpactTransactionsResult => {
    const { allTransactions, signableAddresses, currentRequest } =
        useSigningPipeline()
    const request = currentRequest as Optional<TransactionSignRequest>

    // The full pre-filter group (or txs) in raw form, for the composer.
    const groupTxs = request?.groupContext ?? request?.txs

    const hasAppCall = useMemo(
        () => allTransactions.some(tx => tx.txType === 'appl'),
        [allTransactions],
    )

    const simulation = useGroupSimulationQuery({
        requestId: request?.id,
        groupTxs,
        enabled: hasAppCall,
    })

    if (simulation.isError) {
        logger.warn('Balance-impact simulation failed; using top-level group', {
            requestId: request?.id,
            error: simulation.error,
        })
    }

    const transactions = useMemo(() => {
        if (simulation.data && simulation.data.length > 0) {
            return [...allTransactions, ...simulation.data]
        }
        return allTransactions
    }, [allTransactions, simulation.data])

    return {
        transactions,
        signableAddresses,
        isSimulating: hasAppCall && simulation.isFetching,
        simulationFailed: hasAppCall && simulation.isError,
    }
}
