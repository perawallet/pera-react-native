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

import { useCallback } from 'react'
import type {
    Arc0001ResolveResult,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { plannerAdapterForScope } from '../chain-adapter'
import type { SourceType } from '../pipeline/types'
import type { SignRequestSource, TransactionSignRequest } from '../models'

import { useSigningRequest } from './useSigningRequest'
import { useMinimumFeeCalculator } from './useMinimumFeeCalculator'

export type ExternalSignTxnTransport = {
    sourceType: SourceType
    transportId: string
    /**
     * WalletConnect JSON-RPC request id (`algo_signTxn` payload id). Set only
     * by the WalletConnect handler; threaded to the multisig sync-flow handoff
     * so the dApp response survives an app kill.
     */
    payloadId?: number
    sourceMetadata?: SignRequestSource
    /** SW/platform-observed origin (trusted, not dApp-asserted) — used for
     *  trust display and sign-in domain binding. */
    verifiedOrigin?: string
    // ARC-0001 response: an array of (SignedTxnStr | null), same length and
    // order as the original request. Returning a Promise lets transports
    // surface delivery failures through the signing pipeline (e.g. WC v1
    // bridge socket revival via the connector registry's `ensureReady`).
    respondWithResult: (result: Nullable<string>[]) => Promise<void> | void
    respondWithReject: () => void
    /**
     * Whether the peer has now been answered. `false` means the transport is
     * holding the request open so the pipeline can RETRY a failed delivery,
     * and the request must stay queued.
     */
    respondWithError: (error: Error) => boolean
    /**
     * Optional clean-reject path for multisig sync handoff. Called when the
     * pipeline finishes the propose flow via `softReject` — the dApp peer
     * is informed of the rejection without raising a connection-error
     * banner.
     */
    respondWithSoftReject?: (error: Error) => Promise<void> | void
}

/**
 * Resolves with the enqueued request, or `null` when the group was answered
 * without one (nothing signable, or an invalid group refused up front). The
 * handle is what lets a transport withdraw the request if the peer stops
 * waiting for it.
 */
export type EnqueueArc0001SignRequest = (
    resolved: Arc0001ResolveResult,
    transport: ExternalSignTxnTransport,
) => Promise<Nullable<TransactionSignRequest>>

// Bridges an ARC-0001 resolver result to the signing pipeline. Transports
// (WC, webview, future deeplinks) hand in the resolved subset plus a response
// interface; the planner builds the TransactionSignRequest.
export const useEnqueueArc0001SignRequest = (
    scope: ChainScope,
): EnqueueArc0001SignRequest => {
    const { addSignRequest, removeSignRequest } = useSigningRequest()
    const { assignFeeToGroup } = useMinimumFeeCalculator(scope.chainId)

    return useCallback(
        (resolved, transport) =>
            plannerAdapterForScope(scope).enqueueDappRequest(
                resolved,
                transport,
                {
                    assignFeeToGroup,
                    addSignRequest,
                    removeSignRequest,
                },
            ),
        [scope, addSignRequest, removeSignRequest, assignFeeToGroup],
    )
}
