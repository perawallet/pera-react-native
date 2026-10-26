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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    MessageRequest,
    ReviewedTransaction,
    SignedMessage,
    ReviewWarning,
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { PeraArbitraryDataMessage, SignRequestTransport } from '../models'
import type { SubmissionHistoryEntry } from '../db/types'

/** A chain-neutral group as the chain's own signers read it; never signable data itself. */
export interface ChainSignerTransactions {
    transactions: UnsignedTransaction[]
    /** Populated only when decoding external requests. */
    rawTransactionsBase64?: string[]
    indicesToSign: number[]
}

/** Chain-neutral transactions: each names its scope, and only its chain reads the payload. */
export interface UnsignedTransactionsSignableData {
    type: 'transactions'
    transactions: UnsignedTransaction[]
    /**
     * Set only for a group keyed by the account it signs for, by its planner's
     * `signableGroupChainData`; only that chain reads it.
     */
    chainData?: unknown
}

/**
 * Keyed by the signer its planner names, so a rekey isn't followed again. A
 * group the chain keys by the account it signs for, whose rekey is followed
 * once, carries that chain's data.
 */
export const isKeyedByPlanner = (data: SignableData): boolean =>
    data.type === 'transactions' && data.chainData === undefined

export interface ArbitraryDataSignableData {
    type: 'arbitrary-data'
    data: PeraArbitraryDataMessage[]
}

/**
 * `data` is opaque to the signing primitive (decoded for user review only).
 * The chain's validator checks that `authenticatorData` binds `domain` before
 * anything is signed.
 */
export interface AuthData {
    /** Encoded payload — decoded for display, hashed for signing. */
    data: string
    /** Address / public key of the signer. */
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

export interface AuthDataMetadata {
    /** Auth scope; only `1` (AUTH) is defined today. */
    scope: number
    /** Encoding of `data` (e.g. 'base64'). */
    encoding: string
}

export type AuthDataPayload = {
    authData: AuthData
    /** Supplied by the dApp. */
    metadata: AuthDataMetadata
}

export interface AuthDataSignableData extends AuthDataPayload {
    type: 'auth-data'
}

/** A chain-neutral message; its chain's message signer plans and signs it. */
export interface MessageSignableData {
    type: 'message'
    request: MessageRequest
}

export type SignableData =
    | UnsignedTransactionsSignableData
    | ArbitraryDataSignableData
    | AuthDataSignableData
    | MessageSignableData

/** Shared by SourceMetadata (pipeline) and SignRequest (models). */
export type SourceType =
    | 'local'
    | 'walletconnect'
    | 'webview'
    | 'deeplink'
    | 'multisig-cosign'
    | 'card'
    | 'gift-card'
    | 'injected' // browser-extension window.pera provider
    | 'replacement' // the wallet re-pricing one of its own pending transactions

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
    'card',
    'gift-card',
    'injected',
    'replacement',
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
 * `card` / `gift-card`.
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
     * See {@link SignRequestTransport}; `'network'` is the implicit default for
     * local requests. External sources always deliver via their own transport
     * regardless — the selector dispatches on `type` first.
     */
    transport?: SignRequestTransport

    peerMetadata?: { name?: string; url?: string; icons?: string[] }

    /**
     * Origin the platform itself observed (the in-app webview's loaded host).
     * Trusted for origin-binding checks because, unlike {@link peerMetadata},
     * it is not dApp-asserted. Unset for transports with no verifiable origin
     * (e.g. WalletConnect). See {@link isAuthDataOriginMismatch}.
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

export interface SubmissionReceipt {
    txIds: string[]
}

export interface SourceCallbacks {
    /** `submission` is set only when the transport broadcast the group before answering. */
    approve?: (
        result: SigningResult,
        submission?: SubmissionReceipt,
    ) => Promise<void>
    reject?: (reason?: RejectReason) => Promise<void>
    error?: (error: Error) => Promise<void>
    /**
     * Delivers pre-encoded canonical msgpack SignedTransaction bytes, skipping
     * the SDK decode + re-encode round-trip. Required for the multisig
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

    /**
     * The authorizer: the signer the dApp named when the request carries one,
     * else the transaction sender or data signer field.
     */
    signerAddress: string

    /**
     * Positions in the full request array, set when a multi-signer request is
     * split into groups. {@link mergeSigningResults} uses them to reassemble
     * in submission order — e.g. 5 txs from 2 senders yields `[0, 2, 4]` and
     * `[1, 3]`.
     */
    originalIndices?: number[]

    /**
     * Set when the request's groups sign in different ways, which have no
     * common signed shape, so this group goes to the chain's own signer rather
     * than the planner.
     */
    shouldUseChainSigner?: boolean
}

export type AnalysisWarning = ReviewWarning

export interface SignableAnalysis {
    totalFees: bigint

    /** Set by a chain-neutral reviewer; Algorand's UI reads its transactions from the request. */
    transactions?: ReviewedTransaction[]

    warnings: AnalysisWarning[]

    /**
     * The wallet's addresses that sign. A chain-neutral transaction is signed
     * only with these keys, so this is what the user approves.
     */
    signableAddresses: string[]

    riskLevel: 'low' | 'medium' | 'high'
}

/** What a group does, before any warning or risk is attached. */
export type DecodedGroup = Pick<
    SignableAnalysis,
    'totalFees' | 'transactions' | 'signableAddresses'
>

export interface AnalysisContext {
    scope: ChainScope
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
 * Signed by the chain's own strategies (local key, hardware, multisig), whose
 * results carry no history entries. A quantum signature is the same type, so
 * there is no carrier to tell apart at consumption sites.
 */
export interface SignedTransactionData {
    type: 'transactions'
    signed: SignedTransaction[]
}

/** Chain-neutral transactions as their chain's planner assembled them. */
export interface SignedChainTransactionsData {
    type: 'signed-transactions'
    signed: SignedTransaction[]
    /** Index-aligned with `signed`; carries no fee, which only the signed bytes give. */
    historyEntries: SubmissionHistoryEntry[]
}

export interface SignedArbitraryData {
    type: 'arbitrary-data'
    signatures: Uint8Array[]
}

export interface SignedAuthData {
    type: 'auth-data'
    signature: Uint8Array
}

export interface SignedMessageData {
    type: 'message'
    signed: SignedMessage
}

export type SignedData =
    | SignedTransactionData
    | SignedChainTransactionsData
    | SignedArbitraryData
    | SignedAuthData
    | SignedMessageData

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

/** Broadcast, then the source's `approve` callback accepted the submitted ids. */
export interface SubmittedAndAnsweredTransportResult {
    type: 'submitted-and-answered'
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
    | SubmittedAndAnsweredTransportResult
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
