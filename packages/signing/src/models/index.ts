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

import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { BaseStoreState, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    Arc60Metadata,
    Arc60StdSigData,
    SignableAnalysis,
    SourceType,
    TransportResult,
} from '../pipeline/types'
import type { ResolvedSignerType } from '../machine/context'

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
     * Multisig-cosign only: the existing sign-request ID being cosigned.
     * Threaded into {@link SourceMetadata.signRequestId} so the cosign
     * transport can target the right backend record.
     */
    signRequestId?: string
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
    rawTransactionsBase64?: string[]
    approve?: (signedTxs: PeraSignedTransaction[]) => Promise<void>
    reject?: () => Promise<void>
    error?: (error: Error) => Promise<void>
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
    reject?: () => Promise<void>
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
    reject?: () => Promise<void>
    error?: (error: Error) => Promise<void>
} & BaseSignRequest

export type SignRequest =
    | TransactionSignRequest
    | ArbitraryDataSignRequest
    | Arc60SignRequest

export type FailedSignRequest = {
    request: SignRequest
    error: Error
}

export type SigningStore = BaseStoreState & {
    pendingSignRequests: SignRequest[]
    lastCompletedRequest: SignRequest | null
    lastFailedRequest: FailedSignRequest | null
    /**
     * Most recent transport result, set on every completed actor transition
     * regardless of source. Drives propose/cosign completion listeners
     * (PendingSignatures auto-open, TransactionProcessingScreen exit) that
     * can't rely on the `useSigningPipeline({ onEvent })` actor subscription
     * — that subscription doesn't reliably establish in time for headless
     * propose requests because the lifecycle's actor lives in a non-reactive
     * module-level Map. Consumers should dedupe via a ref-tracked previous
     * reference; the lifecycle creates a fresh `TransportResult` object per
     * completion so reference equality is a safe change signal.
     */
    lastTransportResult: TransportResult | null
    addSignRequest: (request: SignRequest) => boolean
    removeSignRequest: (request: SignRequest) => boolean
    setLastCompletedRequest: (request: Nullable<SignRequest>) => void
    setLastFailedRequest: (failed: Nullable<FailedSignRequest>) => void
    setLastTransportResult: (result: Nullable<TransportResult>) => void
}

export type TransactionWarning = {
    type: 'close' | 'rekey' | 'asset-freeze'
    senderAddress: string
    targetAddress: string
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
