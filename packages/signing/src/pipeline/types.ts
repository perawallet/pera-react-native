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

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    PeraTransaction,
    PeraSignedTransaction,
    PeraTransactionType,
} from '@perawallet/wallet-core-blockchain'
import type { PeraArbitraryDataMessage } from '../models'

export interface TransactionSignableData {
    type: 'transactions'
    transactions: PeraTransaction[]
    /** Populated only when decoding external requests. */
    rawTransactionsBase64?: string[]
    indicesToSign: number[]
}

export interface ArbitraryDataSignableData {
    type: 'arbitrary-data'
    data: PeraArbitraryDataMessage[]
}

/**
 * Per ARC-60, `data` is opaque to the signing primitive (decoded for user
 * review only). The wallet must verify
 * `authenticatorData[0:32] === sha256(utf8(domain))` before signing.
 */
export interface Arc60StdSigData {
    /** Encoded payload — decoded for display, hashed for signing. */
    data: string
    /** Algorand address / Ed25519 public key of the signer. */
    signer: string
    /** Origin requesting the signature (URL / DID / identifier). */
    domain: string
    /** FIDO/WebAuthn authenticator data; first 32 bytes = sha256(domain). */
    authenticatorData: Uint8Array
    /** Echoed by the dApp for replay-protection. */
    requestId?: string
    /** BIP44 path the dApp expects the wallet to use. */
    hdPath?: string
}

export interface Arc60Metadata {
    /** ARC-60 scope; only `1` (AUTH) is defined today. */
    scope: number
    /** Encoding of `data` (e.g. 'base64'). */
    encoding: string
}

export interface Arc60SignableData {
    type: 'arc60'
    stdSigData: Arc60StdSigData
    metadata: Arc60Metadata
}

export type SignableData =
    | TransactionSignableData
    | ArbitraryDataSignableData
    | Arc60SignableData

/** Shared by SourceMetadata (pipeline) and SignRequest (models). */
export type SourceType =
    | 'local'
    | 'walletconnect'
    | 'webview'
    | 'deeplink'
    | 'multisig-cosign'
    | 'arc60'
    | 'gift-card'
    | 'injected' // browser-extension injected ARC-0027 dapp provider (M4b)

/**
 * Sources that pause at `awaiting_user` for the in-app review flow. Everything
 * else (`'local'`, undefined) runs headless — the originating screen owns its
 * own confirmation UI and the approval gate's unregistered fast-path
 * auto-resumes the machine. A new external source generally belongs here too.
 */
export const INTERACTIVE_SOURCES = [
    'walletconnect',
    'webview',
    'deeplink',
    'multisig-cosign',
    'arc60',
    'gift-card',
    'injected',
] as const satisfies readonly SourceType[]

export const isInteractiveSource = (
    sourceType: SourceType | undefined,
): boolean =>
    sourceType !== undefined &&
    (INTERACTIVE_SOURCES as readonly SourceType[]).includes(sourceType)

/**
 * Sources whose signed result goes back to an out-of-app caller via
 * {@link SourceCallbacks} rather than to algod. A strict subset of
 * {@link INTERACTIVE_SOURCES} — excludes `multisig-cosign` (own transport) and
 * `arc60` / `gift-card`.
 */
export const EXTERNAL_CALLBACK_SOURCES = [
    'walletconnect',
    'webview',
    'deeplink',
    'injected',
] as const satisfies readonly SourceType[]

export const isExternalCallbackSource = (
    sourceType: SourceType | undefined,
): boolean =>
    sourceType !== undefined &&
    (EXTERNAL_CALLBACK_SOURCES as readonly SourceType[]).includes(sourceType)

/**
 * Advisory hints for the transport layer (absence = defaults). Namespaced by
 * concern so the generic pipeline types don't accumulate one-off flags.
 */
export interface SignRequestTransportOptions {
    multisig?: {
        /**
         * Local in-app sends default to `'async'` (backend broadcasts once
         * threshold is met); external handoffs default to `'sync'`.
         * Shared-account swaps force `'sync'` so the backend does NOT
         * broadcast — the proposer assembles the composite multisig,
         * interleaves the pre-signed slots, and submits to algod itself.
         */
        proposeMode?: 'sync' | 'async'
    }
}

export interface SourceMetadata {
    type: SourceType

    /**
     * `'algod'` (implicit default for local requests) submits to the network;
     * `'callback'` hands signed bytes back via `callbacks.approve`. External
     * sources always deliver via their own transport regardless — the selector
     * dispatches on `type` first.
     */
    transport?: 'algod' | 'callback'

    peerMetadata?: { name?: string; url?: string; icons?: string[] }

    /**
     * Origin the platform itself observed (the in-app webview's loaded host).
     * Trusted for origin-binding checks because, unlike {@link peerMetadata},
     * it is not dApp-asserted. Unset for transports with no verifiable origin
     * (e.g. WalletConnect). See {@link isArc60OriginMismatch}.
     */
    verifiedOrigin?: string

    /** For multisig co-sign. */
    signRequestId?: string

    transportOptions?: SignRequestTransportOptions

    /** Original request ID for callbacks. */
    requestId?: string

    callbacks?: SourceCallbacks

    /**
     * Serializable WalletConnect sync-flow delivery context, set only for
     * WalletConnect requests (identified by a JSON-RPC `payloadId`). Carried to
     * the multisig-propose transport so it can persist a recovery context on
     * the handoff, letting a resumed-after-kill handoff answer the dApp without
     * the in-memory closures. Mirrors `WalletConnectHandoffRecovery`.
     */
    handoffDelivery?: {
        clientId: string
        payloadId: number
        indicesToSign: number[]
        totalLength: number
    }
}

/**
 * `'softReject'` means the request was handed off to another flow (e.g. a
 * backend multisig sign-request) and no inline response will arrive.
 * Implementers must NOT raise a connection-error banner for it — it is a
 * success-path event.
 */
export type RejectReason =
    | { kind: 'user' }
    | { kind: 'softReject'; error: Error }

export interface SourceCallbacks {
    approve?: (result: SigningResult) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
    /**
     * Delivers pre-encoded canonical msgpack SignedTransaction bytes, skipping
     * algosdk's decode + re-encode round-trip. Required for the multisig
     * sync-flow handoff: canonical-msgpack rules differ across SDKs, so
     * re-encoding can produce bytes whose signatures algod won't verify.
     * Length and order MUST match the original request.
     */
    approveSignedBytes?: (bytes: Uint8Array[]) => Promise<void>
    /**
     * Fired once the backend sign-request is created, before the headless
     * propose flow resolves. Lets an asynchronous in-app proposer (the
     * shared-account swap) capture the `signRequestId` and exact raw
     * transactions so it can finish the swap once threshold is met.
     */
    onProposed?: (info: {
        signRequestId: string
        status: SignRequestStatus
        rawTransactionsBase64: string[]
    }) => Promise<void>
}

export interface SignableGroup {
    data: SignableData

    source: SourceMetadata

    /** Resolved from transaction senders or the data signer field. */
    signerAddress: string

    /**
     * Positions in the full request array, set when a multi-signer request is
     * split into groups. {@link mergeSigningResults} uses them to reassemble
     * in submission order — e.g. 5 txs from 2 senders yields `[0, 2, 4]` and
     * `[1, 3]`.
     */
    originalIndices?: number[]
}

export interface DataSource<TParams = unknown> {
    getSignableData(params: TParams): Promise<SignableGroup>
}

export interface TransactionSummary {
    type: PeraTransactionType
    sender: string
    receiver?: string
    amount?: bigint
    assetId?: bigint
    note?: string
}

export interface AnalysisWarning {
    type:
        | 'high-fee'
        | 'unknown-contract'
        | 'large-amount'
        | 'close-account'
        | 'rekey'
        | 'suspicious'
    severity: 'info' | 'warning' | 'danger'
    message: string
}

export interface SignableAnalysis {
    totalFees: bigint

    transactionSummaries: TransactionSummary[]

    warnings: AnalysisWarning[]

    /** Addresses that need to provide signatures. */
    signableAddresses: string[]

    riskLevel: 'low' | 'medium' | 'high'
}

export interface AnalysisContext {
    network: Network
    /** All user accounts, for detecting internal transfers. */
    accounts: WalletAccount[]
    /** Known contracts/apps, for risk assessment. */
    knownContracts?: Map<bigint, ContractInfo>
}

export interface ContractInfo {
    name: string
    verified: boolean
    risk: 'low' | 'medium' | 'high'
}

export interface AnalyzedSignableGroup extends SignableGroup {
    analysis: SignableAnalysis
}

export interface DataAnalyzer {
    analyze(
        group: SignableGroup,
        context: AnalysisContext,
    ): Promise<SignableAnalysis>
}

/** The UI layer maps these to i18n keys and appropriate UI treatment. */
export type SigningPhase =
    | 'connecting'
    | 'awaiting-approval'
    | 'reviewing-transaction'
    | 'reviewing-data'

export interface SigningCallbacks {
    onSigningStart?: () => void

    onProgress?: (current: number, total: number) => void

    /** Any strategy may emit phases relevant to its flow. */
    onPhaseChange?: (phase: SigningPhase) => void

    onSigningComplete?: () => void

    onError?: (error: Error) => void

    /**
     * Hardware strategies check this before every device exchange and
     * disconnect the transport when it fires, so an app-side cancel reaches
     * the BLE layer — otherwise a detached exchange walks the user through
     * approvals that are already discarded. Strategies without long-lived
     * device sessions may ignore it.
     */
    signal?: AbortSignal
}

export interface SignerInfo {
    address: string
    /** For multisig: base64 signatures per item. */
    signatures?: Nullable<string>[]
}

/**
 * `signed` is uniformly `PeraSignedTransaction[]`: a quantum signature is that
 * same type with `pqsig` set instead of `sig`, produced by the very same
 * `createLocalKeyStrategy` as Algo25/HD accounts, so there is no carrier type
 * to distinguish at consumption sites.
 */
export interface SignedTransactionData {
    type: 'transactions'
    signed: PeraSignedTransaction[]
}

export interface SignedArbitraryData {
    type: 'arbitrary-data'
    signatures: Uint8Array[]
}

export interface SignedArc60Data {
    type: 'arc60'
    signature: Uint8Array
}

export type SignedData =
    | SignedTransactionData
    | SignedArbitraryData
    | SignedArc60Data

export interface SigningResult {
    signedData: SignedData

    signers: SignerInfo[]

    /** Carried over from {@link SignableGroup.originalIndices}. */
    originalIndices?: number[]
}

export interface SigningStrategy {
    canSign(account: WalletAccount): boolean

    sign(
        group: AnalyzedSignableGroup,
        account: WalletAccount,
        callbacks?: SigningCallbacks,
    ): Promise<SigningResult>
}

export interface SubmittedTransportResult {
    type: 'submitted'
    txIds: string[]
}

export interface CallbackTransportResult {
    type: 'callback-sent'
    requestId: string
}

export interface ProposedTransportResult {
    type: 'proposed'
    signRequestId: string
    status: SignRequestStatus
    /**
     * External sources are sync-flow handoffs: listeners fire a "request
     * created" toast and the transport resolves the external peer via
     * `softReject`. `'local'` is the legacy proposer-initiated path from
     * in-app screens (Send, etc.).
     */
    sourceType: SourceType
}

export interface SignaturesAddedTransportResult {
    type: 'signatures-added'
    signRequestId: string
    status: SignRequestStatus
}

/**
 * Mirrors the multisig backend's state machine. Source of truth:
 * `signRequestResponseSchema` in `packages/multisig/src/api/schema.ts`.
 */
export type SignRequestStatus =
    | 'pending'
    | 'ready'
    | 'submitting'
    | 'confirmed'
    | 'failed'
    | 'expired'
    | 'declined'

export type TransportResult =
    | SubmittedTransportResult
    | CallbackTransportResult
    | ProposedTransportResult
    | SignaturesAddedTransportResult

export interface DataTransport {
    send(
        result: SigningResult,
        source: SourceMetadata,
        /** For multisig: the multisig account address. */
        multisigAddress?: string,
    ): Promise<TransportResult>
}

export interface PipelineCallbacks extends SigningCallbacks {
    /** Called after analysis, before signing — show confirmation UI. */
    onConfirmationRequired?: (group: AnalyzedSignableGroup) => Promise<boolean>

    onWarnings?: (warnings: AnalysisWarning[]) => void
}

export interface PipelineConfig<TSourceParams> {
    source: DataSource<TSourceParams>

    /** Defaults to the standard analyzer. */
    analyzer?: DataAnalyzer

    /** Overrides transport selection. */
    transport?: DataTransport

    callbacks?: PipelineCallbacks
}

export interface DataPipeline<TSourceParams> {
    /** Runs source -> analyze -> sign -> transport. */
    execute(
        params: TSourceParams,
        account: WalletAccount,
    ): Promise<TransportResult>
}

export type QueuedRequestStatus =
    | 'pending'
    | 'analyzing'
    | 'awaiting-confirmation'
    | 'signing'
    | 'transporting'
    | 'complete'
    | 'failed'

export interface QueuedRequest<TParams = unknown> {
    id: string
    params: TParams
    account: WalletAccount
    source: SourceMetadata
    status: QueuedRequestStatus
    analyzedGroup?: AnalyzedSignableGroup
    error?: Error
    createdAt: number
}
