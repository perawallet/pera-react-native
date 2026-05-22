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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { AnyActorRef } from 'xstate'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { mapToDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { canSignWith, useAllAccounts } from '@perawallet/wallet-core-accounts'
import type { PipelineStage, TransactionSignRequest } from '../models'
import {
    createTransactionListItems,
    classifyRequestStructure,
} from '../utils/classification'
import { calculateTotalFee } from '../utils/fees'
import { aggregateTransactionWarnings } from '../utils/warnings'
import type {
    SigningConfiguration,
    SigningPipeline,
    MachineSnapshot,
} from './types'
import {
    EMPTY_TRANSACTIONS,
    EMPTY_LIST_ITEMS,
    EMPTY_WARNINGS,
    EMPTY_SIGNABLE_ADDRESSES,
    ZERO_FEE,
    deriveStage,
    isRetryableError,
    deriveEvent,
} from './utils'
import { useSigningRequest } from './useSigningRequest'
import type { Nullable } from '@perawallet/wallet-core-shared'

// =============================================================================
// Result type alias
// =============================================================================

export type UseSigningPipelineResult = SigningPipeline

export const useSigningPipeline = (
    config: SigningConfiguration = {},
): UseSigningPipelineResult => {
    const { onEvent } = config

    const {
        currentRequest,
        currentActorRef,
        signAndSendRequest,
        rejectRequest,
        retryRequest,
    } = useSigningRequest()

    const accounts = useAllAccounts()

    // -------------------------------------------------------------------------
    // Display data — computed from the request's transaction payload.
    // Uses the same logic as useSigningRequestAnalysis for zero-regression.
    // -------------------------------------------------------------------------

    const txRequest =
        currentRequest?.type === 'transactions' && 'txs' in currentRequest
            ? (currentRequest as TransactionSignRequest)
            : undefined

    const displayData = useMemo(() => {
        const allTransactions = (txRequest?.txs ?? [])
            .map(tx => mapToDisplayableTransaction(tx))
            .filter((tx): tx is PeraDisplayableTransaction => !!tx)

        const listItems = createTransactionListItems(allTransactions)

        const signableAddresses = new Set(
            accounts.filter(a => canSignWith(a, accounts)).map(a => a.address),
        )

        const userAccountAddresses = new Set(accounts.map(a => a.address))

        const totalFee = calculateTotalFee(allTransactions, signableAddresses)

        const warnings = aggregateTransactionWarnings(
            allTransactions,
            userAccountAddresses,
        )

        const distinctWarnings = warnings.filter(
            (warning, index) =>
                warnings.findIndex(w => w.type === warning.type) === index,
        )

        const requestStructure = classifyRequestStructure(listItems)

        return {
            allTransactions,
            listItems,
            signableAddresses,
            totalFee,
            warnings,
            distinctWarnings,
            requestStructure,
        }
    }, [txRequest?.txs, accounts])

    // -------------------------------------------------------------------------
    // Machine state — derived from actor subscription
    // -------------------------------------------------------------------------

    const [stage, setStage] = useState<PipelineStage>('idle')
    const [error, setError] = useState<Nullable<Error>>(null)

    // Keep onEvent in a ref so the subscription closure never goes stale
    const onEventRef = useRef(onEvent)
    onEventRef.current = onEvent

    // Track the previous stage to fire events only on transitions
    const prevStageRef = useRef<Nullable<PipelineStage>>(null)

    useEffect(() => {
        if (!currentActorRef) {
            setStage('idle')
            setError(null)
            prevStageRef.current = null
            return
        }

        const subscription = (currentActorRef as AnyActorRef).subscribe(
            rawSnapshot => {
                const snapshot = rawSnapshot as MachineSnapshot
                const newStage = deriveStage(snapshot)

                setStage(newStage)
                setError(snapshot.context.error)

                if (newStage !== prevStageRef.current) {
                    const event = deriveEvent(snapshot, newStage)
                    if (event) {
                        onEventRef.current?.(event)
                    }
                    prevStageRef.current = newStage
                }
            },
        )

        return () => {
            subscription.unsubscribe()
            prevStageRef.current = null
        }
    }, [currentActorRef])

    // -------------------------------------------------------------------------
    // Controls
    // -------------------------------------------------------------------------

    const next = useCallback(() => {
        if (!currentRequest) return
        signAndSendRequest(currentRequest)
    }, [currentRequest, signAndSendRequest])

    const fail = useCallback(() => {
        if (!currentRequest) return
        rejectRequest(currentRequest)
    }, [currentRequest, rejectRequest])

    const retry = useCallback(() => {
        if (!currentRequest) return
        retryRequest(currentRequest)
    }, [currentRequest, retryRequest])

    // -------------------------------------------------------------------------
    // Derived flags
    // -------------------------------------------------------------------------

    const isLoading = stage === 'signing' || stage === 'transporting'
    const isRetryable = stage === 'failed' && isRetryableError(error)

    return {
        currentRequest,
        stage,
        isLoading,
        isRetryable,
        error,
        allTransactions: txRequest
            ? displayData.allTransactions
            : EMPTY_TRANSACTIONS,
        listItems: txRequest ? displayData.listItems : EMPTY_LIST_ITEMS,
        signableAddresses: txRequest
            ? displayData.signableAddresses
            : EMPTY_SIGNABLE_ADDRESSES,
        totalFee: txRequest ? displayData.totalFee : ZERO_FEE,
        warnings: txRequest ? displayData.warnings : EMPTY_WARNINGS,
        distinctWarnings: txRequest
            ? displayData.distinctWarnings
            : EMPTY_WARNINGS,
        requestStructure: txRequest ? displayData.requestStructure : 'single',
        next,
        fail,
        retry,
    }
}
