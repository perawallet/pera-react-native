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

import type { Network } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
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
    rawTransactionsBase64: string[]
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
 * Arc60 structured data for signing
 */
export interface Arc60SignableData {
    type: 'arc60'
    structuredData: Arc60Data
}

/**
 * Arc60 structured data format
 */
export interface Arc60Data {
    domain: string
    message: Record<string, unknown>
    primaryType: string
    types: Record<string, Array<{ name: string; type: string }>>
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
 * Metadata about where signable data came from
 */
export interface SourceMetadata {
    type: 'local' | 'walletconnect' | 'multisig-cosign' | 'arc60'

    /** For WalletConnect: the dApp info */
    peerMetadata?: { name?: string; url?: string; icons?: string[] }

    /** For multisig co-sign: the sign request ID */
    signRequestId?: string

    /** Original request ID for callbacks */
    requestId?: string

    /** For WalletConnect/Arc60: callback functions */
    callbacks?: SourceCallbacks
}

/**
 * Callbacks for external sources (WalletConnect, etc.)
 */
export interface SourceCallbacks {
    approve?: (result: SigningResult) => Promise<void>
    reject?: () => Promise<void>
    error?: (error: string) => Promise<void>
}

/**
 * A group of signable data ready for the pipeline
 */
export interface SignableGroup {
    /** The data to sign */
    data: SignableData

    /** Metadata about where this came from */
    source: SourceMetadata
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
    /** Human-readable description */
    description: string
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
 * Hardware wallet prompt types
 */
export interface HardwarePrompt {
    type: 'connect' | 'approve' | 'review-transaction' | 'review-data'
    message: string
    /** For review: details to show */
    details?: TransactionSummary | { message: string }
}

/**
 * Callbacks for UI integration during signing
 */
export interface SigningCallbacks {
    /** Called when signing starts */
    onSigningStart?: () => void

    /** Called with progress updates */
    onProgress?: (current: number, total: number) => void

    /** Called when hardware wallet needs user action */
    onHardwarePrompt?: (prompt: HardwarePrompt) => Promise<void>

    /** Called when signing completes */
    onSigningComplete?: () => void

    /** Called on error */
    onError?: (error: Error) => void
}

/**
 * Information about a signer
 */
export interface SignerInfo {
    address: string
    /** For multisig: base64 signatures per item */
    signatures?: (string | null)[]
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
 * Sign request status from backend
 */
export type SignRequestStatus = 'pending' | 'ready' | 'submitted' | 'failed'

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
        /** For multisig: the joint account address */
        jointAccountAddress?: string,
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
