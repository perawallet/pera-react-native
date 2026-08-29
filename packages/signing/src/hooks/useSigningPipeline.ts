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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { AnyActorRef } from 'xstate'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { mapToDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    canSignWith,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PipelineStage, TransactionSignRequest } from '../models'
import {
    createTransactionListItems,
    classifyRequestStructure,
} from '../utils/classification'
import { calculateTotalFee, detectHighGroupFee } from '../utils/fees'
import { aggregateTransactionWarnings } from '../utils/warnings'
import type {
    SigningConfiguration,
    SigningPipeline,
    MachineSnapshot,
    ResolvedSignRequest,
    ActiveSigningChild,
    HardwareChildSnapshot,
} from './types'
import { buildResolvedSignRequest } from './buildResolvedSignRequest'
import {
    EMPTY_TRANSACTIONS,
    EMPTY_LIST_ITEMS,
    EMPTY_WARNINGS,
    EMPTY_SIGNABLE_ADDRESSES,
    EMPTY_SIGNABLE_INDICES,
    EMPTY_FEE_ADJUSTMENTS,
    ZERO_FEE,
    deriveStage,
    isRetryableError,
    deriveEvent,
} from './utils'
import { useSigningRequest } from './useSigningRequest'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseSigningPipelineResult = SigningPipeline

/**
 * Pure transform: a transaction request + the wallet's accounts → everything
 * the signing UI renders (displayable txns, grouped list items, fees,
 * warnings, structure). At 1000 transactions this is ~800ms of work.
 */
const computeDisplayData = (
    txRequest: TransactionSignRequest,
    accounts: WalletAccount[],
) => {
    // Show the FULL atomic group when the source filtered down to a
    // signable subset — gives the user context for partial-group
    // requests (e.g. cross-account atomic flows). `signableIndices`
    // tells the UI which slots are actually being signed.
    const source = txRequest.groupContext ?? txRequest.txs ?? []
    const allTransactions = source
        .map(tx => mapToDisplayableTransaction(tx))
        .filter((tx): tx is PeraDisplayableTransaction => !!tx)

    // Default to "every index is signable" when groupContext is absent
    // (internal flows) — keeps the UI's "is this slot signable" check
    // working without per-caller bookkeeping.
    const signableIndices = new Set<number>(
        txRequest.signableIndices ?? allTransactions.map((_, i) => i),
    )

    const listItems = createTransactionListItems(
        allTransactions,
        signableIndices,
    )

    const signableAddresses = new Set(
        accounts.filter(a => canSignWith(a, accounts)).map(a => a.address),
    )

    const userAccountAddresses = new Set(accounts.map(a => a.address))

    const totalFee = calculateTotalFee(allTransactions, signableAddresses)

    // Gate warnings on the authorizing entity, not the raw sender: a dApp
    // can set a foreign `sender` it never imported while signing with an
    // account the wallet holds via `signerOverrides`. Keyed by position in
    // `txs` (the signable subset), so translate into `allTransactions`'
    // index space — `signableIndices` maps that position to its slot in
    // `groupContext` when the full group is shown.
    const authorizerByIndex = new Map<number, string>()
    if (txRequest.signerOverrides) {
        const usingGroupContext = !!txRequest.groupContext
        for (const [subsetIndex, authorizer] of txRequest.signerOverrides) {
            const displayIndex = usingGroupContext
                ? (txRequest.signableIndices?.[subsetIndex] ?? subsetIndex)
                : subsetIndex
            authorizerByIndex.set(displayIndex, authorizer)
        }
    }

    const addressWarnings = aggregateTransactionWarnings(
        allTransactions,
        userAccountAddresses,
        signableAddresses,
        authorizerByIndex,
    )

    // High fee is a group-level concern ("what's being signed"), so it
    // lives here rather than in the per-transaction aggregator that the
    // transaction-history view also consumes.
    const highFeeWarning = detectHighGroupFee(
        allTransactions,
        signableAddresses,
    )
    const warnings = highFeeWarning
        ? [...addressWarnings, highFeeWarning]
        : addressWarnings

    const distinctWarnings = warnings.filter(
        (warning, index) =>
            warnings.findIndex(w => w.type === warning.type) === index,
    )

    const requestStructure = classifyRequestStructure(listItems)

    return {
        allTransactions,
        listItems,
        signableAddresses,
        signableIndices,
        totalFee,
        warnings,
        distinctWarnings,
        requestStructure,
    }
}

type DisplayData = ReturnType<typeof computeDisplayData>

const EMPTY_DISPLAY_DATA: DisplayData = {
    allTransactions: EMPTY_TRANSACTIONS,
    listItems: EMPTY_LIST_ITEMS,
    signableAddresses: EMPTY_SIGNABLE_ADDRESSES,
    signableIndices: EMPTY_SIGNABLE_INDICES,
    totalFee: ZERO_FEE,
    warnings: EMPTY_WARNINGS,
    distinctWarnings: EMPTY_WARNINGS,
    requestStructure: 'single',
}

// Module-level single-entry cache. Only one sign request is active at a time
// (single-flight queue), yet the signing sheet mounts ~6-8 components that
// each call useSigningPipeline. Without sharing, every consumer — and every
// actor-snapshot re-render — reran the full O(n) transform above, which at
// 1000 txns meant ~8×800ms of duplicated main-thread work that froze the UI
// and starved the bottom-sheet present animation. Keyed by
// request identity + its input arrays (referentially stable from the store)
// + the accounts reference, so it recomputes exactly when an input changes.
let displayDataCache: {
    requestId: string
    txs: unknown
    groupContext: unknown
    signableIndices: unknown
    signerOverrides: unknown
    accounts: unknown
    result: DisplayData
} | null = null

const getSharedDisplayData = (
    txRequest: TransactionSignRequest,
    accounts: WalletAccount[],
): DisplayData => {
    if (
        displayDataCache &&
        displayDataCache.requestId === txRequest.id &&
        displayDataCache.txs === txRequest.txs &&
        displayDataCache.groupContext === txRequest.groupContext &&
        displayDataCache.signableIndices === txRequest.signableIndices &&
        displayDataCache.signerOverrides === txRequest.signerOverrides &&
        displayDataCache.accounts === accounts
    ) {
        return displayDataCache.result
    }
    const result = computeDisplayData(txRequest, accounts)
    displayDataCache = {
        requestId: txRequest.id,
        txs: txRequest.txs,
        groupContext: txRequest.groupContext,
        signableIndices: txRequest.signableIndices,
        signerOverrides: txRequest.signerOverrides,
        accounts,
        result,
    }
    return result
}

/**
 * Releases the cached display data. Called when no transaction request is
 * active so the (potentially large, 1000-txn) cached arrays aren't retained
 * at module scope after the signing sheet closes — otherwise the last
 * request's data lingers until the next request happens to overwrite it.
 */
const clearDisplayDataCache = (): void => {
    displayDataCache = null
}

/** Test-only alias for clearing the shared cache between cases. */
export const __resetDisplayDataCacheForTests = clearDisplayDataCache

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

    // Display data — computed from the request's transaction payload.
    // Uses the same logic as useSigningRequestAnalysis for zero-regression.

    const txRequest =
        currentRequest?.type === 'transactions' && 'txs' in currentRequest
            ? (currentRequest as TransactionSignRequest)
            : undefined

    const displayData = useMemo(
        () =>
            txRequest
                ? getSharedDisplayData(txRequest, accounts)
                : EMPTY_DISPLAY_DATA,
        [txRequest, accounts],
    )

    // Release the shared cache once no transaction request is active — i.e.
    // when the queue drains as the signing sheet closes. While a request is
    // active the entry is keyed by its id and shared across the sheet's many
    // consumers; this just stops the trailing entry from being retained.
    // Clearing is idempotent, so concurrent consumers running it is harmless.
    useEffect(() => {
        if (!txRequest) {
            clearDisplayDataCache()
        }
    }, [txRequest])

    // Machine state — derived from actor subscription

    const [stage, setStage] = useState<PipelineStage>('idle')
    const [error, setError] = useState<Nullable<Error>>(null)
    const [resolved, setResolved] =
        useState<Nullable<ResolvedSignRequest>>(null)

    // Keep onEvent in a ref so the subscription closure never goes stale
    const onEventRef = useRef(onEvent)
    onEventRef.current = onEvent

    // Track the previous stage to fire events only on transitions
    const prevStageRef = useRef<Nullable<PipelineStage>>(null)

    useEffect(() => {
        if (!currentActorRef) {
            setStage('idle')
            setError(null)
            setResolved(null)
            prevStageRef.current = null
            return
        }

        const actor = currentActorRef as AnyActorRef

        // Extract the hardware child snapshot from the parent snapshot's
        // `children` map. The parent invokes the child with id 'hardwareChild'
        // (see signingMachine.ts → states.signing.states.hardware.invoke).
        const readActiveChild = (
            snapshot: MachineSnapshot,
        ): ActiveSigningChild => {
            const children = (
                snapshot as {
                    children?: Record<string, AnyActorRef | undefined>
                }
            ).children
            const hardwareChild = children?.hardwareChild
            if (!hardwareChild) return null
            const childSnapshot = (
                hardwareChild as { getSnapshot?: () => unknown }
            ).getSnapshot?.() as HardwareChildSnapshot | undefined
            if (!childSnapshot) return null
            return { kind: 'hardware', snapshot: childSnapshot }
        }

        const project = (
            snapshot: MachineSnapshot,
        ): ResolvedSignRequest | null => {
            const base = buildResolvedSignRequest(snapshot.context)
            if (!base) return null
            return { ...base, activeChild: readActiveChild(snapshot) }
        }

        // Seed from the current snapshot so a late-mount picks up state
        // without waiting for the next machine transition. Guard against
        // mocks/actors that don't implement getSnapshot().
        const getSnapshot = (actor as { getSnapshot?: () => unknown })
            .getSnapshot
        if (typeof getSnapshot === 'function') {
            const initialSnapshot = getSnapshot.call(actor) as MachineSnapshot
            if (initialSnapshot?.context) {
                setResolved(project(initialSnapshot))
            }
        }

        // Track the latest child subscription so we can resubscribe whenever
        // the parent invokes a new hardware child (or tears one down). XState
        // v5 parent snapshots don't always re-emit when only the child's
        // sub-state changes; subscribing to the child directly guarantees the
        // UI re-renders on phase transitions (searching → awaiting_approval →
        // signing) and on PROGRESS events.
        let childUnsubscribe: (() => void) | null = null
        let lastHardwareChild: AnyActorRef | null = null

        const syncChildSubscription = (parentSnapshot: MachineSnapshot) => {
            const children = (
                parentSnapshot as {
                    children?: Record<string, AnyActorRef | undefined>
                }
            ).children
            const hardwareChild = children?.hardwareChild ?? null
            if (hardwareChild === lastHardwareChild) return
            if (childUnsubscribe) {
                childUnsubscribe()
                childUnsubscribe = null
            }
            lastHardwareChild = hardwareChild
            if (!hardwareChild) return
            // Reproject immediately on (re)subscribe so the very first child
            // snapshot is observed without waiting for the next child event.
            const currentParent = (
                actor as { getSnapshot?: () => unknown }
            ).getSnapshot?.() as MachineSnapshot | undefined
            if (currentParent?.context) {
                setResolved(project(currentParent))
            }
            const childSub = hardwareChild.subscribe(() => {
                const nextParent = (
                    actor as { getSnapshot?: () => unknown }
                ).getSnapshot?.() as MachineSnapshot | undefined
                if (nextParent?.context) {
                    setResolved(project(nextParent))
                }
            })
            childUnsubscribe = () => childSub.unsubscribe()
        }

        const subscription = actor.subscribe(rawSnapshot => {
            const snapshot = rawSnapshot as MachineSnapshot
            const newStage = deriveStage(snapshot)

            setStage(newStage)
            setError(snapshot.context.error)
            setResolved(project(snapshot))
            syncChildSubscription(snapshot)

            if (newStage !== prevStageRef.current) {
                const event = deriveEvent(snapshot, newStage)
                if (event) {
                    onEventRef.current?.(event)
                }
                prevStageRef.current = newStage
            }
        })

        // Seed the child subscription from the initial snapshot so the very
        // first child phase change is observed even if it lands before the
        // parent subscribe fires.
        if (typeof getSnapshot === 'function') {
            const initialSnapshot = getSnapshot.call(actor) as MachineSnapshot
            if (initialSnapshot?.context) {
                syncChildSubscription(initialSnapshot)
            }
        }

        return () => {
            subscription.unsubscribe()
            if (childUnsubscribe) {
                childUnsubscribe()
                childUnsubscribe = null
            }
            lastHardwareChild = null
            prevStageRef.current = null
        }
    }, [currentActorRef])

    const next = useCallback(() => {
        if (!currentRequest) return
        // A retryable failure leaves the actor parked in `failed`, where
        // resolving the approval gate (signAndSendRequest) is a no-op — the
        // actor is no longer waiting on it. Re-attempting via the same
        // control (e.g. the ARC-60 slide-to-confirm after "device locked" /
        // "app not open") must RETRY the actor so the device re-prompts,
        // rather than silently doing nothing.
        if (stage === 'failed' && isRetryableError(error)) {
            retryRequest(currentRequest)
            return
        }
        signAndSendRequest(currentRequest)
    }, [currentRequest, signAndSendRequest, retryRequest, stage, error])

    const fail = useCallback(() => {
        if (!currentRequest) return
        rejectRequest(currentRequest)
    }, [currentRequest, rejectRequest])

    const retry = useCallback(() => {
        if (!currentRequest) return
        retryRequest(currentRequest)
    }, [currentRequest, retryRequest])

    const retryHardware = useCallback(() => {
        ;(currentActorRef as AnyActorRef | null)?.send({
            type: 'RETRY_HARDWARE',
        })
    }, [currentActorRef])

    const acknowledgeHardwareError = useCallback(() => {
        ;(currentActorRef as AnyActorRef | null)?.send({
            type: 'ACKNOWLEDGE_HARDWARE_ERROR',
        })
    }, [currentActorRef])

    const isLoading = stage === 'signing' || stage === 'transporting'
    const isRetryable = stage === 'failed' && isRetryableError(error)
    // TTCDIAG: temporary instrumentation, remove before commit. Logged only on
    // change — a per-render log perturbed the race enough to hide it.
    const lastStageRef = useRef<string>('')
    if (lastStageRef.current !== String(stage)) {
        lastStageRef.current = String(stage)
        console.log(
            `[TTCDIAG] pipeline stage=${String(stage)} error=${String((error as { message?: string } | null)?.message ?? error ?? '')}`,
        )
    }

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
        signableIndices: txRequest
            ? displayData.signableIndices
            : EMPTY_SIGNABLE_INDICES,
        totalFee: txRequest ? displayData.totalFee : ZERO_FEE,
        warnings: txRequest ? displayData.warnings : EMPTY_WARNINGS,
        distinctWarnings: txRequest
            ? displayData.distinctWarnings
            : EMPTY_WARNINGS,
        requestStructure: txRequest ? displayData.requestStructure : 'single',
        feeAdjustments: txRequest?.feeAdjustments ?? EMPTY_FEE_ADJUSTMENTS,
        next,
        fail,
        retry,
        resolved,
        retryHardware,
        acknowledgeHardwareError,
    }
}
