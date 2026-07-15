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
import type {
    AccountType,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    PeraTransaction,
    PeraSignedTransaction,
    PeraTransactionType,
} from '@perawallet/wallet-core-blockchain'
import type { PeraArbitraryDataMessage } from '../models'

// =============================================================================
// Stage 1: Signable Data Types
// =============================================================================

/**
 * Transaction data ready for signing
 */
export interface TransactionSignableData {
    type: 'transactions'
    transactions: PeraTransaction[]
    /** Base64-encoded raw transactions. Optional — populated when decoding external requests. */
    rawTransactionsBase64?: string[]
    indicesToSign: number[]
}

/**
 * Arbitrary data for signing (raw bytes)
 */
export interface ArbitraryDataSignableData {
    type: 'arbitrary-data'
    data: PeraArbitraryDataMessage[]
}

/**
 * ARC-60 structured signing request payload (StdSigData).
 *
 * Per ARC-60, `data` is opaque to the signing primitive (it is shown to the
 * user after decoding for review only). The wallet must verify that
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
    /** Optional unique request id (echoed by the dApp for replay-protection). */
    requestId?: string
    /** Optional BIP44 path the dApp expects the wallet to use. */
    hdPath?: string
}

/**
 * ARC-60 metadata accompanying a sign request.
 */
export interface Arc60Metadata {
    /** ARC-60 scope; only `1` (AUTH) is defined today. */
    scope: number
    /** Encoding of `data` (e.g. 'base64'). */
    encoding: string
}

/**
 * ARC-60 signable data wrapper for the pipeline.
 */
export interface Arc60SignableData {
    type: 'arc60'
    stdSigData: Arc60StdSigData
    metadata: Arc60Metadata
}

/**
 * Union of all signable data types
 */
export type SignableData =
    | TransactionSignableData
    | ArbitraryDataSignableData
    | Arc60SignableData

// =============================================================================
// Stage 1: Source Types
// =============================================================================

/**
 * All possible origins for signable data.
 * Used by both SourceMetadata (pipeline) and SignRequest (models).
 */
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
 * Source types that the in-app standard review flow gates on. A request
 * whose `sourceType` is in this list pauses for user confirmation: the
 * actor lifecycle registers an approval gate when the actor is created
 * and the signing machine blocks at `awaiting_user` until the gate is
 * resolved by `signAndSendRequest` / `rejectRequest`. Everything else
 * (`'local'`, undefined) runs headless — the originating screen owns
 * its own confirmation UI and the gate's unregistered fast-path
 * auto-resumes the machine.
 *
 * Adding a new external source generally means appending it here too.
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
 * External sources whose signed result is delivered back to an out-of-app
 * caller via {@link SourceCallbacks} rather than submitted to algod. The
 * transport selector routes these to the WalletConnect / callback transport
 * (non-multisig) or the multisig propose transport's sync-flow handoff
 * (multisig). A strict subset of {@link INTERACTIVE_SOURCES} — excludes
 * `multisig-cosign` (its own transport) and `arc60` / `gift-card`.
 *
 * Adding a new external callback source means appending it here only.
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
 * Optional, transport-routing hints for a sign request. Namespaced by concern
 * so the generic pipeline types don't accumulate one-off top-level flags;
 * everything here is advisory to the transport layer (absence = defaults).
 */
export interface SignRequestTransportOptions {
    /** Multisig-propose route tuning. */
    multisig?: {
        /**
         * Propose `type` sent to the backend. Local in-app sends default to
         * `'async'` (backend broadcasts once threshold is met); external
         * handoffs default to `'sync'`. Shared-account swaps set `'sync'` so the
         * backend does NOT broadcast — the proposer assembles the composite
         * multisig, interleaves the pre-signed slots, and submits to algod.
         */
        proposeMode?: 'sync' | 'async'
    }
}

/**
 * Metadata about where signable data came from
 */
export interface SourceMetadata {
    type: SourceType

    /**
     * How signed data should be delivered.
     * - `'algod'`: submit directly to the network. Implicit default when the
     *   request originates locally.
     * - `'callback'`: hand signed bytes back to the caller via
     *   `callbacks.approve`.
     *
     * External sources (`walletconnect`, `webview`, `deeplink`,
     * `multisig-cosign`, `arc60`) always deliver via their own transport
     * regardless of this field — the selector dispatches on `type` first.
     */
    transport?: 'algod' | 'callback'

    /** For WalletConnect: the dApp info */
    peerMetadata?: { name?: string; url?: string; icons?: string[] }

    /**
     * Origin the platform itself observed the request arriving from (the in-app
     * webview's loaded host). Trusted for origin-binding checks because, unlike
     * {@link peerMetadata}, it is not dApp-asserted. Unset for transports with
     * no verifiable origin (e.g. WalletConnect). See
     * {@link isArc60OriginMismatch}.
     */
    verifiedOrigin?: string

    /** For multisig co-sign: the sign request ID */
    signRequestId?: string

    /**
     * Optional transport-routing hints (e.g. multisig propose mode). Namespaced
     * by concern so this generic type stays free of one-off flags.
     */
    transportOptions?: SignRequestTransportOptions

    /** Original request ID for callbacks */
    requestId?: string

    /** For WalletConnect/Arc60: callback functions */
    callbacks?: SourceCallbacks
}

/**
 * Why a sign request is being rejected at the peer. `'user'` is the
 * common path (the user tapped Decline). `'softReject'` is used when the
 * request was handed off to another flow (e.g. a multisig sign-request
 * created on the backend) and the peer needs to know the inline response
 * will not arrive — implementers must NOT raise an in-app connection-error
 * banner, this is a success-path event.
 */
export type RejectReason =
    | { kind: 'user' }
    | { kind: 'softReject'; error: Error }

/**
 * Callbacks for external sources (WalletConnect, etc.)
 */
export interface SourceCallbacks {
    approve?: (result: SigningResult) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
    /**
     * Alternative delivery path: hand pre-encoded canonical msgpack
     * SignedTransaction bytes to the external peer without going through
     * algosdk's decode + re-encode round-trip.
     *
     * Required for the multisig sync-flow handoff: the resolver assembles
     * per-participant subsigs into a composite multisig SignedTransaction
     * and must embed the original raw transaction bytes verbatim, because
     * canonical-msgpack rules can differ across SDKs and re-encoding may
     * produce bytes whose signatures algod won't verify.
     *
     * Length and order MUST match the original request — implementers
     * (e.g. WC handler) align each item with the corresponding txn in
     * the original `algo_signTxn` request before responding.
     */
    approveSignedBytes?: (bytes: Uint8Array[]) => Promise<void>
    /**
     * Fired by the multisig propose transport once the backend sign-request
     * is created, before the headless propose flow resolves. Lets an in-app
     * proposer that delivers asynchronously — the shared-account swap flow —
     * capture the backend `signRequestId` and the exact raw transactions sent,
     * so it can register a handoff to finish the swap once threshold is met.
     */
    onProposed?: (info: {
        signRequestId: string
        status: SignRequestStatus
        rawTransactionsBase64: string[]
    }) => Promise<void>
}

/**
 * A group of signable data ready for the pipeline
 */
export interface SignableGroup {
    /** The data to sign */
    data: SignableData

    /** Metadata about where this came from */
    source: SourceMetadata

    /**
     * The address of the account that should sign this group.
     * Resolved from transaction senders or the data signer field.
     */
    signerAddress: string

    /**
     * Original positions of these transactions in the full request array.
     * Set when a request is split into multiple groups (multi-signer requests).
     * Used by {@link mergeSigningResults} to reassemble signed transactions
     * in the correct submission order.
     *
     * @example
     * // A request with 5 txs from 2 senders:
     * // Group A (sender A): originalIndices = [0, 2, 4]
     * // Group B (sender B): originalIndices = [1, 3]
     */
    originalIndices?: number[]
}

/**
 * A source provides signable data
 */
export interface DataSource<TParams = unknown> {
    getSignableData(params: TParams): Promise<SignableGroup>
}

// =============================================================================
// Stage 2: Analysis Types
// =============================================================================

/**
 * Summary of a single transaction
 */
export interface TransactionSummary {
    type: PeraTransactionType
    sender: string
    receiver?: string
    amount?: bigint
    assetId?: bigint
    note?: string
}

/**
 * Warning detected during analysis
 */
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

/**
 * Analysis result attached to signable group
 */
export interface SignableAnalysis {
    /** Total fees across all transactions */
    totalFees: bigint

    /** Per-transaction summaries */
    transactionSummaries: TransactionSummary[]

    /** Warnings/risks detected */
    warnings: AnalysisWarning[]

    /** Addresses that need to provide signatures */
    signableAddresses: string[]

    /** Whether this appears safe to sign */
    riskLevel: 'low' | 'medium' | 'high'
}

/**
 * Context provided to analyzers
 */
export interface AnalysisContext {
    /** Current network */
    network: Network
    /** All user accounts (for detecting internal transfers) */
    accounts: WalletAccount[]
    /** Known contracts/apps (for risk assessment) */
    knownContracts?: Map<bigint, ContractInfo>
}

/**
 * Information about a known contract
 */
export interface ContractInfo {
    name: string
    verified: boolean
    risk: 'low' | 'medium' | 'high'
}

/**
 * Analyzed signable group - ready for signing
 */
export interface AnalyzedSignableGroup extends SignableGroup {
    analysis: SignableAnalysis
}

/**
 * An analyzer inspects signable data and produces analysis
 */
export interface DataAnalyzer {
    analyze(
        group: SignableGroup,
        context: AnalysisContext,
    ): Promise<SignableAnalysis>
}

// =============================================================================
// Stage 3: Signing Types
// =============================================================================

/**
 * Signing lifecycle phases that strategies can report.
 * The UI layer maps these to i18n keys and appropriate UI treatment.
 */
export type SigningPhase =
    | 'connecting'
    | 'awaiting-approval'
    | 'reviewing-transaction'
    | 'reviewing-data'

/**
 * Callbacks for UI integration during signing
 */
export interface SigningCallbacks {
    /** Called when signing starts */
    onSigningStart?: () => void

    /** Called with progress updates */
    onProgress?: (current: number, total: number) => void

    /**
     * Called when the signing strategy enters a new phase that the UI may
     * want to reflect (e.g. showing a "connect your device" or "approve on device" prompt).
     * Any strategy can emit phases relevant to its flow.
     */
    onPhaseChange?: (phase: SigningPhase) => void

    /** Called when signing completes */
    onSigningComplete?: () => void

    /** Called on error */
    onError?: (error: Error) => void

    /**
     * Aborts the signing session. Hardware strategies check it before every
     * device exchange and disconnect the transport when it fires, so an
     * app-side cancel/timeout reaches the BLE layer (dismissing the on-device
     * prompt and evicting the library's cached transport) instead of leaving
     * a detached exchange walking the user through discarded approvals.
     * Strategies without long-lived device sessions may ignore it.
     */
    signal?: AbortSignal
}

/**
 * Information about a signer
 */
export interface SignerInfo {
    address: string
    /** For multisig: base64 signatures per item */
    signatures?: Nullable<string>[]
    /**
     * Account type of the signer, when the signing strategy knows it. Lets the
     * submission boundary detect quantum signers without parsing signature
     * bytes. Populated by createLocalKeyStrategy (and, once it lands, the
     * dedicated quantum strategy — PQ-006).
     */
    accountType?: AccountType
}

/**
 * Signed transaction data
 */
export interface SignedTransactionData {
    type: 'transactions'
    signed: PeraSignedTransaction[]
}

/**
 * Signed arbitrary data
 */
export interface SignedArbitraryData {
    type: 'arbitrary-data'
    signatures: Uint8Array[]
}

/**
 * Signed Arc60 data
 */
export interface SignedArc60Data {
    type: 'arc60'
    signature: Uint8Array
}

/**
 * Union of all signed data types
 */
export type SignedData =
    | SignedTransactionData
    | SignedArbitraryData
    | SignedArc60Data

/**
 * Result of signing
 */
export interface SigningResult {
    /** The signed data */
    signedData: SignedData

    /** The signers that participated */
    signers: SignerInfo[]

    /**
     * Original positions of these signed transactions in the full request array.
     * Carried over from the corresponding {@link SignableGroup.originalIndices}.
     * Used by {@link mergeSigningResults} to reassemble signed transactions
     * in the correct submission order.
     */
    originalIndices?: number[]
}

/**
 * A signing strategy handles the actual cryptographic signing
 */
export interface SigningStrategy {
    /**
     * Can this strategy sign for the given account?
     */
    canSign(account: WalletAccount): boolean

    /**
     * Sign the data
     */
    sign(
        group: AnalyzedSignableGroup,
        account: WalletAccount,
        callbacks?: SigningCallbacks,
    ): Promise<SigningResult>
}

// =============================================================================
// Stage 4: Transport Types
// =============================================================================

/**
 * Result of submitting to algod
 */
export interface SubmittedTransportResult {
    type: 'submitted'
    txIds: string[]
}

/**
 * Result of callback to WalletConnect
 */
export interface CallbackTransportResult {
    type: 'callback-sent'
    requestId: string
}

/**
 * Result of proposing multisig transaction
 */
export interface ProposedTransportResult {
    type: 'proposed'
    signRequestId: string
    status: SignRequestStatus
    /**
     * Source the propose was triggered from. External sources
     * (`walletconnect` / `webview` / `deeplink`) are sync-flow handoffs:
     * listeners use this to fire a "request created" toast and the
     * transport itself uses it to resolve the external peer via
     * `softReject`. `'local'` propose is the legacy proposer-initiated
     * path from in-app screens (Send, etc.).
     */
    sourceType: SourceType
}

/**
 * Result of adding signatures to existing multisig request
 */
export interface SignaturesAddedTransportResult {
    type: 'signatures-added'
    signRequestId: string
    status: SignRequestStatus
}

/**
 * Sign request status reported by the multisig backend. Mirrors the
 * server-side state machine: a propose / cosign call may resolve to any of
 * these depending on whether threshold was met, whether submission to algod
 * has started/finished, or whether the request was declined or expired.
 *
 * Source of truth: `signRequestResponseSchema` in
 * `packages/multisig/src/api/schema.ts`.
 */
export type SignRequestStatus =
    | 'pending'
    | 'ready'
    | 'submitting'
    | 'confirmed'
    | 'failed'
    | 'expired'
    | 'declined'

/**
 * Union of all transport results
 */
export type TransportResult =
    | SubmittedTransportResult
    | CallbackTransportResult
    | ProposedTransportResult
    | SignaturesAddedTransportResult

/**
 * A transport delivers signed data to its destination
 */
export interface DataTransport {
    /**
     * Send the signed data to its destination
     */
    send(
        result: SigningResult,
        source: SourceMetadata,
        /** For multisig: the multisig account address */
        multisigAddress?: string,
    ): Promise<TransportResult>
}

// =============================================================================
// Pipeline Types
// =============================================================================

/**
 * Pipeline callbacks extending signing callbacks
 */
export interface PipelineCallbacks extends SigningCallbacks {
    /** Called after analysis, before signing - show confirmation UI */
    onConfirmationRequired?: (group: AnalyzedSignableGroup) => Promise<boolean>

    /** Called when analysis detects warnings */
    onWarnings?: (warnings: AnalysisWarning[]) => void
}

/**
 * Configuration for creating a pipeline
 */
export interface PipelineConfig<TSourceParams> {
    /** The data source (factory function) */
    source: DataSource<TSourceParams>

    /** The analyzer (optional, defaults to standard) */
    analyzer?: DataAnalyzer

    /** Override transport selection (optional) */
    transport?: DataTransport

    /** UI callbacks */
    callbacks?: PipelineCallbacks
}

/**
 * A transaction pipeline executes the full flow
 */
export interface DataPipeline<TSourceParams> {
    /**
     * Execute the full pipeline: source -> analyze -> sign -> transport
     */
    execute(
        params: TSourceParams,
        account: WalletAccount,
    ): Promise<TransportResult>
}

// =============================================================================
// Queue Types
// =============================================================================

/**
 * Status of a queued request
 */
export type QueuedRequestStatus =
    | 'pending'
    | 'analyzing'
    | 'awaiting-confirmation'
    | 'signing'
    | 'transporting'
    | 'complete'
    | 'failed'

/**
 * A queued pipeline request awaiting execution
 */
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
