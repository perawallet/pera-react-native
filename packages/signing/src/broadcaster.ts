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

import {
    createChainAdapterRegistry,
    type ChainId,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-chain-contract'

import type { Network } from '@perawallet/wallet-core-shared'
import type { SignRequest } from './models'
import type { DataTransport } from './pipeline/types'
import type { IntentKey, SubmissionFlow } from './db/types'

export type OnConfirmedHandler = (
    affectedAddresses: string[],
    network: Network,
) => void | Promise<void>

/**
 * Invoked when the reconciler terminally settles an open attempt of a
 * registered flow, e.g. the cosign flow replays its post-submit tail on
 * confirmation, or fails + declines the retained handoff on a definitive
 * failure. Best-effort by contract: a throw is logged, never propagated.
 */
export type SubmissionSettledHandler = (
    txIds: string[],
    network: string,
    status: 'confirmed' | 'failed',
) => void | Promise<void>

export type ReconcileSummary = {
    /** Rows this pass examined, whether or not they settled. */
    probed: number
    confirmed: number
    failed: number
}

export type DerivedSubmissionAttempt = {
    txIds: string[]
    /** Highest lastValid in the group, in rounds. */
    lastValid?: number
}

/**
 * The flow's identity, so a rebuild/retry can be matched against an earlier
 * unresolved attempt. Defaults to the generic flow.
 */
export type SubmitAndAutoRefreshOptions = {
    flow?: SubmissionFlow
    intentKey?: IntentKey
    sender?: string
}

/** The chain-specific leg of submitting signed transactions; registered by the chain package. */
export interface BroadcasterChainAdapter {
    chainId: ChainId
    /**
     * @param capturedNetwork - The network active when the signing actor was
     *   created; re-compared at send time so a mid-flow network switch aborts
     *   instead of submitting to the wrong chain.
     */
    createSubmitTransport(capturedNetwork: Network): DataTransport
    /** Resolves with the tx ids once the node accepts; confirmation is awaited in the background. */
    submitAndAutoRefresh(
        signedTxns: PeraSignedTransaction[],
        options?: SubmitAndAutoRefreshOptions,
    ): Promise<string[]>
    /** Whether the attempt journal already holds this request's group as landed or landable. */
    isRequestGroupAlreadySubmitted(request: SignRequest): Promise<boolean>
    reconcileOpenSubmissions(): Promise<ReconcileSummary>
    deriveSubmissionAttemptFromBytes(
        bytesList: readonly Uint8Array[],
    ): DerivedSubmissionAttempt
    setOnConfirmedHandler(handler: OnConfirmedHandler | null): void
    setSubmissionSettledHandler(
        flow: SubmissionFlow,
        handler: SubmissionSettledHandler | null,
    ): void
}

export const broadcasterChainAdapters =
    createChainAdapterRegistry<BroadcasterChainAdapter>('broadcaster')

export const submitAndAutoRefresh = (
    chainId: ChainId,
    ...args: Parameters<BroadcasterChainAdapter['submitAndAutoRefresh']>
) => broadcasterChainAdapters.get(chainId).submitAndAutoRefresh(...args)

export const reconcileOpenSubmissions = (chainId: ChainId) =>
    broadcasterChainAdapters.get(chainId).reconcileOpenSubmissions()

export const deriveSubmissionAttemptFromBytes = (
    chainId: ChainId,
    ...args: Parameters<
        BroadcasterChainAdapter['deriveSubmissionAttemptFromBytes']
    >
) =>
    broadcasterChainAdapters
        .get(chainId)
        .deriveSubmissionAttemptFromBytes(...args)

export const setOnConfirmedHandler = (
    chainId: ChainId,
    handler: OnConfirmedHandler | null,
) => broadcasterChainAdapters.get(chainId).setOnConfirmedHandler(handler)

export const setSubmissionSettledHandler = (
    chainId: ChainId,
    flow: SubmissionFlow,
    handler: SubmissionSettledHandler | null,
) =>
    broadcasterChainAdapters
        .get(chainId)
        .setSubmissionSettledHandler(flow, handler)
