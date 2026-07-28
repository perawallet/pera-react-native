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

import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    type BaseStoreState,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    Arc60Metadata,
    Arc60StdSigData,
    RejectReason,
    SignableAnalysis,
    SignRequestTransportOptions,
    SourceType,
    TransportResult,
} from '../pipeline/types'
import type { ResolvedSignerType } from '../machine/context'
import type { FeeAdjustment } from '../pipeline/sources/assignMinimumFeesToGroup'

export type SignRequestSource = {
    name?: string
    description?: string
    url?: string
    icons?: string[]
}

type BaseSignRequest = {
    id: string
    type: 'transactions' | 'arbitrary-data' | 'arc60'
    transport: 'algod' | 'callback'
    transportId?: string
    /** Origin of the request. Defaults to 'local' when not specified. */
    sourceType?: SourceType
    sourceMetadata?: SignRequestSource
    /**
     * Origin the platform itself observed the request arriving from (the
     * in-app webview's loaded host). Unlike {@link sourceMetadata}, this is
     * NOT dApp-asserted, so it can be trusted for origin-binding checks (e.g.
     * ARC-60 SIWA domain ↔ origin). Left unset for transports with no
     * verifiable origin (e.g. WalletConnect, whose peer URL is self-asserted).
     */
    verifiedOrigin?: string
    /**
     * Multisig-cosign only: the existing sign-request ID being cosigned.
     * Threaded into {@link SourceMetadata.signRequestId} so the cosign
     * transport can target the right backend record.
     */
    signRequestId?: string
    /**
     * Optional transport-routing hints, namespaced by concern (e.g.
     * `transportOptions.multisig.proposeMode`). Threaded through to
     * {@link SourceMetadata.transportOptions} so transports can read them
     * without the generic request type accumulating one-off flags.
     */
    transportOptions?: SignRequestTransportOptions
}

export type TransactionSignRequest = {
    txs: PeraTransaction[]
    /**
     * The full atomic transaction group from the originating source, used
     * for ARC-0001 group-integrity validation. External sources that filter
     * `txs` down to the wallet's signable subset (e.g. WalletConnect)
     * **must** populate this with the original pre-filter array so the
     * signing pipeline can recompute the group hash. Sources where `txs`
     * already is the full group should leave this unset; the pipeline
     * falls back to `txs` for validation in that case.
     */
    groupContext?: PeraTransaction[]
    /**
     * Per-transaction signer address overrides (index in `txs` → address).
     * When present, the signing pipeline uses this address instead of
     * `tx.sender` to determine who should sign.
     * Populated from ARC-0001 `signers` field in WalletConnect requests.
     */
    signerOverrides?: Map<number, string>
    /**
     * Indices into `groupContext` (the full pre-filter payload) that
     * correspond to entries in `txs`. Populated when `groupContext`
     * differs from `txs` so the signing UI can render the full atomic
     * group while marking which slots the wallet will actually sign.
     */
    signableIndices?: number[]
    rawTransactionsBase64?: string[]
    /** Fees the pipeline raised to a required minimum (each record carries its reason — today only the PQ minimum for quantum signers); indices in groupContext space. UI shows original → adjusted; absent when nothing was modified. */
    feeAdjustments?: FeeAdjustment[]
    /**
     * Delivers the signed group back to the requester. A quantum-signed
     * transaction is just a `PeraSignedTransaction` with `pqsig` set instead
     * of `sig`, so all signers flow through this one shape unchanged (see
     * `buildSourceMetadata` in `machine/actions.ts`). Entries are `Nullable`
     * because the enqueue implementation pads unsignable slots
     * (contract-signed / unresolved signer) with `null` to preserve the
     * original ARC-0001 slot order.
     */
    approve?: (signedTxs: Nullable<PeraSignedTransaction>[]) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
    /**
     * Alternative delivery path: hand pre-encoded SignedTransaction bytes
     * to the peer (skipping algosdk's decode + re-encode roundtrip). Used
     * by the multisig sync-flow resolver to deliver the assembled
     * composite multisig signed transaction with the original txn bytes
     * embedded verbatim — critical so per-participant signatures verify.
     */
    approveSignedBytes?: (bytes: Uint8Array[]) => Promise<void>
    /**
     * Multisig propose only: fired once the backend sign-request is created
     * (see {@link SourceCallbacks.onProposed}). The shared-account swap flow
     * uses it to register a handoff with the backend `signRequestId` so the
     * swap completes once the co-signer signs.
     */
    onProposed?: (info: {
        signRequestId: string
        status: import('../pipeline/types').SignRequestStatus
        rawTransactionsBase64: string[]
    }) => Promise<void>
} & BaseSignRequest

export type PeraArbitraryDataMessage = {
    signer: string
    data: string
    message?: string
    chainId: number
}

export type PeraArbitraryDataSignResult = {
    signature: Uint8Array
    signer: string
}

export type ArbitraryDataSignRequest = {
    data: PeraArbitraryDataMessage[]
    approve?: (signed: PeraArbitraryDataSignResult[]) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
} & BaseSignRequest

export type Arc60SignRequest = {
    /**
     * Spec-defined signing payload. The encoded `data`, `domain`,
     * `authenticatorData`, and optional `hdPath` are all consumed by the
     * signing pipeline; `signer` selects the signing account.
     */
    stdSigData: Arc60StdSigData
    /** Scope + encoding metadata supplied by the dApp. */
    metadata: Arc60Metadata
    /**
     * Approve callback. Always invoked with a single-element array so the
     * existing `algo_signData` response shape (array of base64 signatures)
     * stays consistent across legacy and ARC-60 modalities.
     */
    approve?: (signed: PeraArbitraryDataSignResult[]) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
} & BaseSignRequest

export type SignRequest =
    | TransactionSignRequest
    | ArbitraryDataSignRequest
    | Arc60SignRequest

export type SigningStore = BaseStoreState & {
    pendingSignRequests: SignRequest[]
    addSignRequest: (request: SignRequest) => boolean
    removeSignRequest: (request: SignRequest) => boolean
}

export type TransactionWarning =
    | {
          type: 'close' | 'rekey' | 'asset-freeze'
          senderAddress: string
          targetAddress: string
      }
    // Group-level: the total fee across signable transactions exceeds the
    // type-aware budget (see detectHighGroupFee). Carries the offending total
    // (µAlgo) for display; has no sender/target since it's not tx-specific.
    | {
          type: 'high-fee'
          totalFee: bigint
      }

/**
 * Flat representation of the signing machine's current state.
 * The 'signing' stage collapses all signing substates (localKey, hardware, multisig).
 */
export type PipelineStage =
    | 'idle' // no request or actor initializing
    | 'validating' // analyzerActor running
    | 'awaiting_user' // waiting for next() or fail()
    | 'signing' // localKey | hardware | multisig actor running
    | 'transporting' // transportActor delivering signed data
    | 'completed' // terminal: signing and delivery succeeded
    | 'rejected' // terminal: user cancelled
    | 'failed' // terminal or retryable: error occurred

/**
 * Events emitted by the pipeline when notable state transitions occur.
 * Fired once per transition via onEvent — not on every context update.
 */
export type SigningPipelineEvent =
    | {
          type: 'analysis_ready'
          /** The machine's analysis result (fees, warnings, risk level) */
          analysis: SignableAnalysis
          /** The signer type that will be used once approved */
          signerType: Nullable<ResolvedSignerType>
      }
    | {
          type: 'signing_started'
          signerType: ResolvedSignerType
      }
    | { type: 'transport_started' }
    | {
          type: 'signing_completed'
          transportResult: TransportResult
      }
    | { type: 'signing_rejected' }
    | {
          type: 'signing_failed'
          error: Error
          /** Which pipeline stage the failure occurred in */
          failedDuringState: Nullable<'validating' | 'signing' | 'transporting'>
          isRetryable: boolean
      }
    /** Reserved for hardware wallet confirmation */
    | { type: 'hardware_confirmation_requested' }

export {
    isTransactionRequest,
    isArbitraryDataRequest,
    isArc60Request,
} from './guards'
