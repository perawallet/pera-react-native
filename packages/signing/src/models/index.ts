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
    ChainId,
    MessageRequest,
    SignedMessage,
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type {
    AuthDataPayload,
    RejectReason,
    SignableAnalysis,
    SignRequestTransportOptions,
    SourceCallbacks,
    SourceType,
    SubmissionReceipt,
    TransportResult,
} from '../pipeline/types'
import type { SignerCustody } from '../machine/utils/resolveSignerCredential'

/**
 * Why a fee was raised. The `quantum-minimum` value predates the switch from a
 * minimum to a surcharge and is kept for wire/log compatibility.
 */
export type FeeAdjustmentReason = 'quantum-minimum'

export type FeeAdjustment = {
    /** Index into the FULL group array (groupContext space) */
    index: number
    /** Base units of the native asset, as received from the dApp */
    originalFee: bigint
    /** Base units of the native asset, after raising to the required minimum */
    adjustedFee: bigint
    /** Which rule required the raise */
    reason: FeeAdjustmentReason
}

export type SignRequestSource = {
    name?: string
    description?: string
    url?: string
    icons?: string[]
}

/**
 * `'network'` submits through the chain's broadcaster; `'callback'` hands the
 * signed bytes back to `approve`; `'submit-and-answer'` submits through the
 * broadcaster and then answers `approve` with the submitted ids.
 */
export type SignRequestTransport = 'network' | 'callback' | 'submit-and-answer'

/** A request whose caller holds in-memory callbacks, which can't be persisted and must hear a rejection. */
export const answersCaller = (transport: SignRequestTransport): boolean =>
    transport !== 'network'

type BaseSignRequest = {
    id: string
    type: 'transactions' | 'arbitrary-data' | 'auth-data' | 'message'
    transport: SignRequestTransport
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

/** Set by whoever builds the request; routes it to that chain's adapters. */
type ChainStamp = {
    chainId: ChainId
}

type TransactionRequestCallbacks = {
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
} & BaseSignRequest

/** Each transaction names its scope, so the request's chain comes from them, never a stamp. */
export type UnsignedTransactionSignRequest = TransactionRequestCallbacks & {
    chainId?: never
    txs: UnsignedTransaction[]
    /**
     * Facts the source sent beside `txs`, such as the full group or the signer
     * it named. Only the scope's planner adapter builds or reads it.
     */
    chainData?: unknown
    /**
     * Entries are `Nullable` because enqueue pads the slots the wallet doesn't
     * sign with `null`, preserving the dApp's slot order.
     */
    approve?: (
        signed: Nullable<SignedTransaction>[],
        submission?: SubmissionReceipt,
    ) => Promise<void>
    approveSignedBytes?: SourceCallbacks['approveSignedBytes']
    onProposed?: SourceCallbacks['onProposed']
    /** Id of the pending transaction this request re-prices at the same sequence number. */
    replacesTxId?: string
}

export type TransactionSignRequest = UnsignedTransactionSignRequest

export type PeraArbitraryDataMessage = {
    signer: string
    data: string
    message?: string
    /** WalletConnect v1 wire concept; absent on transports that have no chain id. */
    chainId?: number
}

export type PeraArbitraryDataSignResult = {
    signature: Uint8Array
    signer: string
}

export type ArbitraryDataSignRequest = ChainStamp & {
    data: PeraArbitraryDataMessage[]
    approve?: (signed: PeraArbitraryDataSignResult[]) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
} & BaseSignRequest

export type AuthDataSignRequest = AuthDataPayload &
    ChainStamp & {
        /**
         * Always invoked with a single-element array, so the response shape stays
         * consistent with arbitrary-data signing.
         */
        approve?: (signed: PeraArbitraryDataSignResult[]) => Promise<void>
        reject?: (reason?: RejectReason) => Promise<void>
        error?: (error: Error) => Promise<void>
    } & BaseSignRequest

/** The chain is `message.scope.chainId`, so there is no separate stamp to disagree with it. */
export type MessageSignRequest = BaseSignRequest & {
    message: MessageRequest
    approve?: (signed: SignedMessage) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
}

export type SignRequest =
    | TransactionSignRequest
    | ArbitraryDataSignRequest
    | AuthDataSignRequest
    | MessageSignRequest

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
    // transactions exceeded the per-group fee allowance (see detectHighGroupFee).
    | {
          type: 'high-fee'
          totalFee: bigint
      }

/** Flattens the machine's state; 'signing' collapses all signing substates. */
export type PipelineStage =
    | 'idle' // no request or actor initializing
    | 'validating' // analyzerActor running
    | 'awaiting_user' // waiting for next() or fail()
    | 'signing' // local | hardware | multisig actor running
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
          signerType: Nullable<SignerCustody>
      }
    | {
          type: 'signing_started'
          signerType: SignerCustody
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
    isAuthDataRequest,
    isMessageRequest,
    isUnsignedTransaction,
    isUnsignedTransactionRequest,
} from './guards'
export {
    reviewGroupOf,
    type ReviewGroup,
    type SignRequestGroupFacts,
} from './reviewGroup'
