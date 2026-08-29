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
    /** See {@link SourceMetadata.verifiedOrigin}. */
    verifiedOrigin?: string
    /** Multisig-cosign only: the existing sign-request being cosigned. */
    signRequestId?: string
    /** Threaded into {@link SourceMetadata.transportOptions}. */
    transportOptions?: SignRequestTransportOptions
}

export type TransactionSignRequest = {
    txs: PeraTransaction[]
    /**
     * The full atomic group, for ARC-0001 group-integrity validation. A source
     * that filters `txs` down to the signable subset (e.g. WalletConnect)
     * **must** set this to the pre-filter array so the pipeline can recompute
     * the group hash. Leave unset when `txs` already is the full group.
     */
    groupContext?: PeraTransaction[]
    /**
     * Index in `txs` -> address. Overrides `tx.sender` when deciding who
     * signs. Populated from ARC-0001 `signers` on WalletConnect requests.
     */
    signerOverrides?: Map<number, string>
    /**
     * Which `groupContext` slots `txs` maps to, so the UI can render the full
     * atomic group while marking the ones the wallet will actually sign.
     */
    signableIndices?: number[]
    rawTransactionsBase64?: string[]
    /**
     * WalletConnect JSON-RPC request id (`algo_signTxn` payload id). Set only
     * for WalletConnect requests; threaded to the multisig sync-flow handoff so
     * the dApp response can be reconstructed after an app kill.
     */
    payloadId?: number
    /**
     * Full atomic-group length. The WalletConnect result array is null-padded
     * to this; carried so the handoff can rebuild it without the enqueue closure.
     */
    totalLength?: number
    /**
     * Fees the pipeline raised to a required minimum, indexed in groupContext
     * space. Absent when nothing was modified.
     */
    feeAdjustments?: FeeAdjustment[]
    /**
     * Entries are `Nullable` because enqueue pads unsignable slots
     * (contract-signed / unresolved signer) with `null`, preserving the
     * original ARC-0001 slot order.
     */
    approve?: (signedTxs: Nullable<PeraSignedTransaction>[]) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
    /** See {@link SourceCallbacks.approveSignedBytes}. */
    approveSignedBytes?: (bytes: Uint8Array[]) => Promise<void>
    /** See {@link SourceCallbacks.onProposed}. */
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
    stdSigData: Arc60StdSigData
    /** Supplied by the dApp. */
    metadata: Arc60Metadata
    /**
     * Always invoked with a single-element array, so the `algo_signData`
     * response shape stays consistent across legacy and ARC-60 modalities.
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
          // 'close-account' is a payment close-remainder-to: the whole account
          // is emptied and deleted. 'close-asset' is an asset-transfer close-to:
          // the sender opts out of that one ASA. Both warrant a warning, but
          // they are not the same severity and must not share copy.
          type: 'close-account' | 'close-asset' | 'rekey' | 'asset-freeze'
          senderAddress: string
          targetAddress: string
      }
    // Group-level, so no sender/target: the total across signable
    // transactions exceeded the type-aware budget (see detectHighGroupFee).
    | {
          type: 'high-fee'
          totalFee: bigint
      }

/** Flattens the machine's state; 'signing' collapses all signing substates. */
export type PipelineStage =
    | 'idle' // no request or actor initializing
    | 'validating' // analyzerActor running
    | 'awaiting_user' // waiting for next() or fail()
    | 'signing' // localKey | hardware | multisig actor running
    | 'transporting' // transportActor delivering signed data
    | 'completed' // terminal: signing and delivery succeeded
    | 'rejected' // terminal: user cancelled
    | 'failed' // terminal or retryable: error occurred

/** Fired once per transition via onEvent — not on every context update. */
export type SigningPipelineEvent =
    | {
          type: 'analysis_ready'
          analysis: SignableAnalysis
          /** The type that will sign once approved. */
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
