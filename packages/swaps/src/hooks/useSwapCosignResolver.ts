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

import { useCallback, useEffect, useMemo } from 'react'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import {
    decodeFromBase64,
    logger,
    toError,
} from '@perawallet/wallet-core-shared'
import {
    addSignature,
    getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey,
    useMarkSignRequestsConfirmedMutation,
    type SignRequestResponse,
} from '@perawallet/wallet-core-multisig'
import {
    classifyHandoffPoll,
    markSubmissionUnknown,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    setSubmissionSettledHandler,
    useHandoffResolver,
    type TerminalHandoffOutcome,
} from '@perawallet/wallet-core-signing'
import { updateSwapStatus, type SwapStatusUpdateRequest } from '../api'
import { submitCosignedSwapGroup, swapChainAdapters } from '../chain-adapter'
import type { SwapHandoffRecord } from '../models'
import { useSwapHandoffStore } from '../store'
import { resolveSwapHandoffOutcome } from '../utils'

/** Stable accessors (module-level so the core's filter memo isn't busted). */
const handoffKey = (handoff: SwapHandoffRecord): string => handoff.signRequestId

const handoffExpiresAt = (detail: SignRequestResponse): number | null => {
    const expiresAt = new Date(detail.expected_expire_datetime).getTime()
    return Number.isNaN(expiresAt) ? null : expiresAt
}

const handoffRegisteredAt = (handoff: SwapHandoffRecord): number =>
    handoff.registeredAt

export type SettleCosignAttemptDeps = {
    markConfirmed: (input: {
        scope: ChainScope
        deviceId: string
        signRequestIds: string[]
    }) => Promise<void>
    updateSwapStatus: (input: {
        scope: ChainScope
        swapId: string
        data: SwapStatusUpdateRequest
    }) => Promise<unknown>
    removeHandoff: (signRequestId: string) => void
}

/**
 * Replays the post-submit tail for retained cosign handoffs once the
 * reconciler settles a submission attempt. Matching is by the handoff's
 * recorded tx ids intersecting the settled group — the handoff is retained
 * after an unknown-outcome submit precisely so this path can finish it.
 */
export const settleCosignAttempt = async (
    handoffs: Record<string, SwapHandoffRecord>,
    settled: ChainScope,
    txIds: string[],
    status: 'confirmed' | 'failed',
    deps: SettleCosignAttemptDeps,
): Promise<void> => {
    const settledTxIds = new Set(txIds)
    const settledScopeKey = toScopeKey(settled)
    const matching = Object.values(handoffs).filter(
        handoff =>
            toScopeKey(handoff.scope) === settledScopeKey &&
            (handoff.submission?.txIds.some(id => settledTxIds.has(id)) ??
                false),
    )

    for (const record of matching) {
        if (status === 'confirmed') {
            await runBestEffort(
                () =>
                    deps.markConfirmed({
                        scope: record.scope,
                        deviceId: record.deviceId,
                        signRequestIds: [record.signRequestId],
                    }),
                'mark-confirmed',
            )
            await runBestEffort(
                () =>
                    deps.updateSwapStatus({
                        scope: record.scope,
                        swapId: record.swapIdStr,
                        data: {
                            status: 'in_progress',
                            submitted_transaction_ids: txIds,
                            swap_version: 'v2',
                        },
                    }),
                'status update',
            )
        } else {
            // The poll detail isn't available at settle time, so the proposer
            // address needed to decline can't be derived — skip the decline
            // rather than cancelling with an incomplete payload.
            logger.warn(
                'swap cosign settle: skipping decline (no proposer address at settle time)',
                { signRequestId: record.signRequestId },
            )
            await runBestEffort(
                () =>
                    deps.updateSwapStatus({
                        scope: record.scope,
                        swapId: record.swapIdStr,
                        data: {
                            status: 'failed',
                            reason: 'blockchain_error',
                            swap_version: 'v2',
                        },
                    }),
                'status update',
            )
        }
        deps.removeHandoff(record.signRequestId)
    }
}

const runBestEffort = async (
    run: () => Promise<unknown>,
    label: string,
): Promise<void> => {
    try {
        await run()
    } catch (error) {
        logger.warn('Swap cosign settle step failed (non-fatal)', {
            step: label,
            error: toError(error).message,
        })
    }
}

export type UseSwapCosignResolverArgs = {
    /** Polling pauses when false (e.g. app backgrounded — iOS suspends timers). */
    isAppActive: boolean
    /**
     * Surface a terminal failure to the user. Injected from the app layer
     * (e.g. the error-toast dispatcher) so this hook stays free of UI deps.
     */
    reportError: (error: unknown) => void
}

/**
 * Completes shared-account (multisig) swaps once the co-signer has signed.
 *
 * The swap analogue of `useWalletConnectHandoffResolver`: a thin adapter over
 * the shared {@link useHandoffResolver}. It sources handoffs from the
 * **persisted** store (so a swap co-signed while the proposer's app was closed
 * is finished on next launch — iOS can't keep a background service alive the
 * way Android does), drives only the handoffs on their chain's selected network
 * (submission must never target the wrong node after a network switch — others
 * wait until the user switches back), and on a terminal outcome hands off to
 * {@link resolveSwapHandoffOutcome}, which assembles the composite multisig,
 * interleaves the pre-signed slots, submits to algod, and reports swap status.
 *
 * Mounted once at the app root (the app wraps this with `AppState` →
 * `isAppActive` and an error-toast → `reportError`).
 */
export const useSwapCosignResolver = ({
    isAppActive,
    reportError,
}: UseSwapCosignResolverArgs): void => {
    const deviceIdOf = useDeviceIdLookup()
    const { markConfirmed } = useMarkSignRequestsConfirmedMutation()
    // A primitive, so the filter below re-runs only when some swap chain's
    // selected network changes. Its entries are `chainId:networkId`.
    const selectedNetworks = useNetworkStore(state =>
        swapChainAdapters
            .list()
            .map(
                ({ chainId }) =>
                    `${chainId}:${selectChainNetworkId(state, chainId)}`,
            )
            .join(),
    )

    const handoffsMap = useSwapHandoffStore(s => s.handoffs)
    const markHandoffSubmitted = useSwapHandoffStore(
        s => s.markHandoffSubmitted,
    )
    const removeHandoff = useSwapHandoffStore(s => s.removeHandoff)

    const handoffs = useMemo(() => {
        const selected = new Set(selectedNetworks.split(','))
        return Object.values(handoffsMap).filter(handoff =>
            selected.has(`${handoff.scope.chainId}:${handoff.scope.networkId}`),
        )
    }, [handoffsMap, selectedNetworks])

    const poll = useCallback(
        (handoff: SwapHandoffRecord) => ({
            queryKey: getSignRequestsWithSignaturesQueryKey(
                handoff.scope,
                handoff.signRequestId,
            ),
            queryFn: () =>
                getSignRequestsWithSignatures(handoff.scope, {
                    device_id: deviceIdOf(deploymentOf(handoff.scope)) ?? '',
                    proposed_sign_request_ids: [handoff.signRequestId],
                }),
            select: (data: SignRequestResponse[]) =>
                data.find(item => item.id === handoff.signRequestId),
            enabled: isAppActive && !!deviceIdOf(deploymentOf(handoff.scope)),
        }),
        [deviceIdOf, isAppActive],
    )

    const classify = useCallback(
        (detail: SignRequestResponse, handoff: SwapHandoffRecord) => {
            // Crash-recovered record whose group already landed on chain: skip
            // classification entirely — no signature re-verification, and no
            // stall if the backend has pruned payloads or moved the request to
            // a post-submit status. The resolver's already-submitted branch
            // ignores the outcome (and these empty bytes) and just replays the
            // post-submit tail.
            if (handoff.submission) {
                return Promise.resolve({
                    kind: 'ready' as const,
                    assembledBytes: [],
                })
            }
            return classifyHandoffPoll(detail, {
                scope: handoff.scope,
                multisigAddress: handoff.multisigAddress,
                msigMetadata: handoff.msigMetadata,
                expectedRawTransactionsBase64:
                    handoff.expectedRawTransactionsBase64,
            })
        },
        [],
    )

    const resolve = useCallback(
        (
            outcome: TerminalHandoffOutcome,
            handoff: SwapHandoffRecord,
            detail: SignRequestResponse | undefined,
        ) => {
            // Proposer address from the poll — the only local participant
            // allowed to cancel the request on a terminal failure. Absent when
            // a client-side deadline fires with no poll body: the decline is
            // best-effort and simply skipped below.
            const proposerAddress = detail?.proposer_address ?? undefined

            return resolveSwapHandoffOutcome({
                outcome,
                record: handoff,
                deps: {
                    submitGroup: bytes =>
                        submitCosignedSwapGroup(handoff.scope, bytes),
                    markSubmitted: txIds =>
                        markHandoffSubmitted(handoff.signRequestId, txIds),
                    decodeBase64: decodeFromBase64,
                    updateSwapStatus: ({ swapId, data }) =>
                        updateSwapStatus(swapId, data, handoff.scope),
                    markConfirmed,
                    removeHandoff,
                    reportError,
                    // Cancel the proposer's own request (decline = the final
                    // word) so the pending sheet/inbox go terminal. Best-effort:
                    // skipped if the backend didn't echo a proposer address or
                    // the device id isn't ready.
                    declineSignRequest: async (signRequestId: string) => {
                        const deviceId = deviceIdOf(deploymentOf(handoff.scope))
                        if (!proposerAddress || !deviceId) return
                        await addSignature(handoff.scope, signRequestId, [
                            {
                                address: proposerAddress,
                                response: 'declined',
                                device_id: deviceId,
                            },
                        ])
                    },
                    recordSubmissionAttempt: params =>
                        recordSubmissionAttempt(params),
                    markSubmissionUnknown: id => markSubmissionUnknown({ id }),
                    markSubmissionFailed: id =>
                        resolveSubmissionAttempt({ id, status: 'failed' }),
                },
            })
        },
        [
            deviceIdOf,
            markConfirmed,
            markHandoffSubmitted,
            removeHandoff,
            reportError,
        ],
    )

    useEffect(() => {
        const cosigningChains = swapChainAdapters
            .list()
            .filter(adapter => adapter.supportsCosignedSwaps)
            .map(({ chainId }) => chainId)
        for (const chainId of cosigningChains) {
            setSubmissionSettledHandler(
                chainId,
                'cosign',
                (txIds, networkId, status) =>
                    settleCosignAttempt(
                        useSwapHandoffStore.getState().handoffs,
                        { chainId, networkId },
                        txIds,
                        status,
                        {
                            markConfirmed,
                            updateSwapStatus: ({ scope, swapId, data }) =>
                                updateSwapStatus(swapId, data, scope),
                            removeHandoff,
                        },
                    ),
            )
        }
        return () => {
            for (const chainId of cosigningChains) {
                setSubmissionSettledHandler(chainId, 'cosign', null)
            }
        }
    }, [markConfirmed, removeHandoff])

    useHandoffResolver<
        SwapHandoffRecord,
        SignRequestResponse[],
        SignRequestResponse
    >({
        handoffs,
        keyOf: handoffKey,
        poll,
        classify,
        resolve,
        expiresAtOf: handoffExpiresAt,
        registeredAtOf: handoffRegisteredAt,
    })
}
