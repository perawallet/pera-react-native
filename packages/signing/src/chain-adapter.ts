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
    type ChainAdapterRegistry,
    type ChainId,
    type ChainScope,
    type SignedTransaction,
    type TransactionNative,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

import { isDebug } from '@perawallet/wallet-core-config'
import type { Decimal } from 'decimal.js'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { PQSchemeId } from '@perawallet/wallet-core-kms'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type { MultisigProposeMode } from '@perawallet/wallet-core-multisig'
import type {
    FeeAdjustment,
    ReviewGroup,
    SignRequest,
    SignRequestGroupFacts,
    TransactionSignRequest,
    UnsignedTransactionSignRequest,
    TransactionWarning,
} from './models'
import type { ExternalSignTxnTransport } from './hooks/useEnqueueDappSignRequest'
import type {
    AnalysisContext,
    AnalysisWarning,
    AnalyzedSignableGroup,
    AuthData,
    AuthDataMetadata,
    ChainSignerTransactions,
    DataTransport,
    DecodedGroup,
    SignableAnalysis,
    SignableGroup,
    SignRequestStatus,
    SigningCallbacks,
    SigningResult,
    SigningStrategy,
    SourceMetadata,
    UnsignedTransactionsSignableData,
} from './pipeline/types'
import type { PendingWalletConnectHandoff } from './pipeline/walletConnectHandoffs'
import type { MessageSignerChainAdapter } from './message-signer'
import { chainIdOfSignRequest } from './models/chain'

export type RequestStructure = 'single' | 'list'

export type SingleTransactionItem = {
    type: 'transaction'
    transaction: TransactionNative
    /** The chain's transaction id, when the chain can derive one before signing. */
    id?: string
    /** Index into the originating groupContext array. */
    groupIndex: number
    /**
     * True when this txn isn't in the wallet's signable subset — shown in the
     * UI for atomic-group completeness only. Defaults to false when no
     * `signableIndices` set is supplied (e.g. internal flows).
     */
    isExternal: boolean
}

export type GroupTransactionItem = {
    type: 'group'
    transactions: SingleTransactionItem[]
    /** Hex. */
    groupId?: string
    groupIndex: number
}

export type TransactionListItem = SingleTransactionItem | GroupTransactionItem

export type DelegatedUnsignableReason = {
    kind: 'authMissing' | 'authIsWatch'
    senderAddress: string
    authAddress: string
}

/** What an address a review shows is to the transaction. */
export type ReviewedAddressRole =
    | 'recipient'
    | 'token-recipient'
    | 'close-recipient'
    | 'new-authorizer'
    | 'referenced-account'
    | 'target'
    | 'spender'
    | 'operator'

export type ReviewedAddress = {
    address: string
    role: ReviewedAddressRole
}

export type ArbitraryDataDisplay =
    | { kind: 'text'; text: string }
    | { kind: 'hex'; hex: string }

/**
 * Explains a group without guessing: what the chain can't identify comes back
 * unrecognised, never as an error. Data it can't trust throws: a transaction
 * for another network, or bytes that don't match what was decoded.
 */
export interface TransactionDecoder {
    decode(
        group: SignableGroup,
        context: AnalysisContext,
    ): Promise<DecodedGroup>
}

export interface WarningDetector {
    /**
     * Reads the decoder's result, so warnings follow what it recognised.
     * Transactions carry warnings only when a wallet account signs them.
     * Synchronous: whatever it needs from the network, the decoder fetches.
     */
    detect(
        group: SignableGroup,
        decoded: DecodedGroup,
        context: AnalysisContext,
    ): AnalysisWarning[]
}

export interface ReviewPolicy {
    /**
     * Whether a request the app built itself may sign without a review screen.
     * One it may not is refused, since a local request has no review screen.
     */
    autoApproveLocal(analysis: SignableAnalysis): boolean
    /** See `TransactionReviewer.policy.matchesApprovedPreview`. */
    matchesApprovedPreview?(
        transaction: UnsignedTransaction,
        preview: UnsignedTransaction,
    ): boolean
}

/** The chain-specific legs of reviewing a sign request; registered by the chain package. */
export interface ReviewerChainAdapter {
    chainId: ChainId
    decoder: TransactionDecoder
    warnings: WarningDetector
    policy: ReviewPolicy
    createTransactionListItems(
        transactions: TransactionNative[],
        signableIndices?: ReadonlySet<number>,
    ): TransactionListItem[]
    classifyRequestStructure(listItems: TransactionListItem[]): RequestStructure
    /** `authorizerByIndex` keys index into `transactions`. */
    aggregateTransactionWarnings(
        transactions: TransactionNative[],
        userAccountAddresses: Set<string>,
        signableAddresses: Set<string>,
        authorizerByIndex?: Map<number, string>,
    ): TransactionWarning[]
    resolveAllSignerAddresses(request: SignRequest): string[]
    getDelegatedUnsignableReason(
        request: SignRequest,
        accounts: WalletAccount[],
    ): Nullable<DelegatedUnsignableReason>
    /** Never throws; anything that isn't cleanly printable comes back as hex. */
    decodeArbitraryDataForDisplay(data: string): ArbitraryDataDisplay
    /**
     * The counterparty addresses the review shows for one transaction, never
     * its sender; `[]` for a transaction it can't read.
     */
    reviewedAddresses(transaction: TransactionNative): ReviewedAddress[]
    /** The review model of one unsigned transaction; null for one the chain can't read. */
    toTransactionNative(
        transaction: UnsignedTransaction,
    ): Nullable<TransactionNative>
}

export const reviewerChainAdapters =
    createChainAdapterRegistry<ReviewerChainAdapter>('reviewer')

export type WithChain<F extends (...args: never[]) => unknown> = (
    chainId: ChainId,
    ...args: Parameters<F>
) => ReturnType<F>

export const createTransactionListItems: WithChain<
    ReviewerChainAdapter['createTransactionListItems']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).createTransactionListItems(...args)

export const classifyRequestStructure: WithChain<
    ReviewerChainAdapter['classifyRequestStructure']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).classifyRequestStructure(...args)

export const aggregateTransactionWarnings: WithChain<
    ReviewerChainAdapter['aggregateTransactionWarnings']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).aggregateTransactionWarnings(...args)

export const resolveAllSignerAddresses: WithChain<
    ReviewerChainAdapter['resolveAllSignerAddresses']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).resolveAllSignerAddresses(...args)

export const getDelegatedUnsignableReason: WithChain<
    ReviewerChainAdapter['getDelegatedUnsignableReason']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).getDelegatedUnsignableReason(...args)

export const decodeArbitraryDataForDisplay: WithChain<
    ReviewerChainAdapter['decodeArbitraryDataForDisplay']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).decodeArbitraryDataForDisplay(...args)

export const reviewedAddressesOf: WithChain<
    ReviewerChainAdapter['reviewedAddresses']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).reviewedAddresses(...args)

export type ResolveMinFeeForSenderParams = {
    senderAddress: string
    /** All wallet accounts, used to resolve the effective signer (auth account) */
    accounts: WalletAccount[]
    /** Network-suggested minimum fee in native base units */
    suggestedMinFee: bigint
    /** Remote-config base minimum txn fee in native base units */
    configMinTxnFee: bigint
    /** Remote-config quantum-signer fee multiplier */
    pqMultiplier: bigint
}

export type AssignFeeToGroupParams = {
    /** Full atomic payload (groupContext space), NOT just the signable subset */
    transactions: UnsignedTransaction[]
    /** Indices into `transactions` the wallet will sign; defaults to all */
    signableIndices?: number[]
    /** Subset-position → the authorizer address the dApp named */
    signerOverrides?: Map<number, string>
    /** A dApp set the fees, so they may already price this wallet's signers. */
    isExternallyPriced?: boolean
}

export type AssignMinimumFeesToGroupResult = {
    /** Same array reference as input when nothing was adjusted; an unchanged entry keeps its reference */
    transactions: UnsignedTransaction[]
    /** Empty when nothing was adjusted */
    adjustments: FeeAdjustment[]
}

export type MinFeeForSenderResult = {
    /** Native base units; undefined while fee parameters load or when there is no sender. */
    minFee: Optional<bigint>
    isPending: boolean
}

export type AssignFeeToGroup = (
    params: AssignFeeToGroupParams,
) => Promise<AssignMinimumFeesToGroupResult>

export type EnqueueDappRequestDeps = {
    assignFeeToGroup: AssignFeeToGroup
    addSignRequest: (request: SignRequest) => void
    removeSignRequest: (request: SignRequest) => void
}

export type BalanceImpactDelta = {
    /** Asset id; `'0'` denotes the native balance. */
    assetId: string
    /** Net change in base units. Positive = received, negative = spent. */
    amount: bigint
}

export type BalanceImpactCreatedAsset = {
    /**
     * Row key. A minted asset has no id until the group is confirmed, so it
     * can't be netted into {@link BalanceImpact.deltas} and is keyed by group
     * position.
     */
    key: string
    name?: string
    unitName?: string
    /** Total supply credited to the creator, in base units. */
    total: bigint
    decimals: number
}

export type BalanceImpact = {
    /**
     * Net per-asset movement across the whole group for the user's accounts.
     * Assets whose movements cancel out (e.g. an internal transfer) are
     * omitted. Order follows first-seen; the view layer sorts for display.
     */
    deltas: BalanceImpactDelta[]
    /** Total fees (µAlgo) the user's accounts pay across the group. */
    totalFeeMicroAlgos: bigint
    /**
     * A close-remainder that sweeps a user account's remaining balance is
     * present. The real outflow then exceeds the explicit `amount`, so the UI
     * must flag it rather than imply the delta is the full story.
     */
    hasCloseRemainder: boolean
    /**
     * Asset ids (`'0'` = ALGO) whose entire remaining balance is swept from a
     * user account, so the UI must present the full balance, not the partial
     * figure in `deltas`.
     */
    closedAssetIds: string[]
    /**
     * Assets minted by one of the user's accounts in this group. A mint moves no
     * existing asset, so it produces no delta.
     */
    createdAssets: BalanceImpactCreatedAsset[]
}

/** A dApp's request to sign transactions, as it sent it. */
export type DappSignRequest = {
    /** Chain-native; only the scope's planner reads it. */
    payload: unknown
}

export type DappResolveContext = {
    /** Addresses the wallet can sign for. Candidates outside this set are skipped, their result slot null. */
    signableAddresses: Set<string>
    /**
     * Optional gate. A candidate in `signableAddresses` but not here is skipped
     * like a third-party sender, not named in an error, so a session bound to
     * its approved accounts learns nothing of the wallet's other accounts.
     */
    authorizedAddresses?: Set<string>
    /**
     * Local multisig addresses. A transaction such an address sends is signed
     * as the multisig itself, whatever signer the dApp names: the dApp can't
     * enumerate the wallet's local participants, so the propose flow collects
     * their signatures.
     */
    multisigAddresses?: ReadonlySet<string>
    maxTransactions?: number
}

/** A dApp sign request after its chain checked it and chose who signs. */
export type DappResolveResult = {
    /** Chain-native; only the planner that resolved it reads it. */
    payload: unknown
}

export type GroupFeeReview = {
    /** In display units of the native token. */
    totalFee: Decimal
    /** Set when the group's fees are out of proportion to what it does. */
    highFeeWarning: Nullable<TransactionWarning>
}

export type PQSigningInfo = { schemeId: PQSchemeId; publicKey: Uint8Array }

export type LocalKeySigningDeps = {
    /**
     * Signs each payload with the child key at `keyPairId`, returning one
     * signature per payload in order. The caller owns key custody and the
     * access-domain check; the adapter never sees private material.
     */
    signPayloads: (
        keyPairId: string,
        payloads: Uint8Array[],
    ) => Promise<Uint8Array[]>
    /**
     * PQ scheme id + public key for a post-quantum child, or `null` for an
     * Ed25519 one. The single oracle for which payload and which envelope
     * field the adapter picks; see `useKMS.getPQSigningInfo` for why payload
     * selection and signer selection must never be able to disagree.
     */
    getPQSigningInfo: (keyPairId: string) => Nullable<PQSigningInfo>
    /**
     * Yields to the event loop between batches. Injectable so a headless
     * caller can run the batching logic without React's scheduling in play.
     */
    yieldBetweenBatches?: () => Promise<void>
}

/** `scope` picks the chain's local-key signer, which reads the scheme off the account's key. */
export type LocalSigningFunction = (
    transactions: UnsignedTransaction[],
    indexesToSign: number[],
    account: WalletAccount,
    scope: ChainScope,
) => Promise<SignedTransaction[]>

export type LocalArbitrarySigningFunction = (
    account: WalletAccount,
    data: string | string[],
) => Promise<Uint8Array[]>

export type LocalAuthDataSigningFunction = (
    account: WalletAccount,
    authData: AuthData,
    metadata: AuthDataMetadata,
) => Promise<Uint8Array>

export type LocalKeyStrategyOptions = {
    signTransactions: LocalSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signAuthData: LocalAuthDataSigningFunction
    scope: ChainScope
}

export type LocalKeySignerInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    signTransactions: LocalSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signAuthData: LocalAuthDataSigningFunction
    scope: ChainScope
}

export type MultisigSignerInput = LocalKeySignerInput & {
    hardwareWalletRegistry?: HardwareWalletRegistry
    signingCallbacks?: SigningCallbacks
}

export interface CreateMultisigStrategyOptions {
    getLocalParticipants: (
        account: WalletAccount,
        allAccounts: WalletAccount[],
    ) => WalletAccount[]
    /** Rekey indirection is intentionally NOT followed here, so no `allAccounts` is threaded through. */
    getStrategyForParticipant: (participant: WalletAccount) => SigningStrategy
    getAllAccounts: () => WalletAccount[]
}

/**
 * The transport supplies the propose `type` (sync for handoffs, async for
 * in-app) so the backend picks the right post-threshold behaviour.
 */
export type ProposeSignRequestFn = (params: {
    multisigAddress: string
    signedData: SigningResult['signedData']
    signers: SigningResult['signers']
    type: MultisigProposeMode
}) => Promise<{
    signRequestId: string
    status: SignRequestStatus
    /**
     * Pinned on the handoff so the resolver can refuse poll responses whose
     * bytes differ from what the user reviewed.
     */
    rawTransactionsBase64: string[]
    /**
     * Proposing participant's address. Pinned on the handoff because the poll
     * response declares it optional and some deployments echo null, leaving
     * the resolver unable to cancel an orphaned request.
     */
    proposerAddress?: string
}>

/** Multisig metadata needed by the resolver listener to build subsigs. */
export type MsigMetadata = {
    version: number
    threshold: number
    addresses: string[]
}

export type GetMsigMetadataFn = (
    multisigAddress: string,
) => Optional<MsigMetadata>

/** Injected so this package doesn't depend on the app's device-id source. */
export type GetDeviceIdFn = () => Optional<string>

/**
 * Everything a later per-row Sign tap needs to bootstrap the real propose from
 * one participant's signature.
 */
export type CreateDraftSignRequestInput = {
    multisigAddress: string
    /**
     * Unsigned envelopes, typed as signed only because they come straight from
     * `SigningResult`. Only the transaction each carries is read, through the
     * planner's `unsignedTransactionBytesOf`, for the bytes the propose API expects.
     */
    signedTransactions: SignedTransaction[]
    proposeType: MultisigProposeMode
    source: SourceMetadata
}

/**
 * Returns a synthetic `draft-`-prefixed id. Injected so this package doesn't
 * depend on the mobile draft store. Absent, the transport throws on empty
 * signers, preserving behaviour for callers that haven't opted in.
 */
export type CreateDraftSignRequestFn = (
    input: CreateDraftSignRequestInput,
) => string

/**
 * Adds signatures to an existing multisig request, or (in the deferred-propose
 * case) bootstraps the backend record from a local draft. For a draft
 * `signRequestId` the implementation proposes instead of adding a signature
 * and returns the real id as `resolvedSignRequestId`.
 */
export type AddSignaturesFn = (params: {
    signRequestId: string
    signers: SigningResult['signers']
}) => Promise<{
    status: SignRequestStatus
    /**
     * Set when the adapter resolved a draft signRequestId to a real backend
     * id (deferred-propose bootstrap). Unset for normal cosign calls.
     */
    resolvedSignRequestId?: string
}>

/**
 * Delivery context a deferred (draft) propose carries to its bootstrap.
 *
 * A hardware-only proposer defers the backend propose to a local draft, but
 * the sync-flow delivery wiring (handoff registration, `onProposed`) can only
 * attach to a real backend record. Without this stash the bootstrapped record
 * is created with `type: 'sync'` and no registered deliverer, so the backend
 * holds it at `ready` forever and every participant's sheet hangs on
 * "Submitting transaction". In-memory on purpose, matching the
 * draft store's lifetime: if the app dies before bootstrap, the draft itself
 * is gone and there is nothing left to deliver.
 */
export type DraftProposeContext = {
    source: SourceMetadata
    /** Validated at draft time; present only for external callback sources. */
    msigMetadata?: MsigMetadata
    /** Validated at draft time; present only for external callback sources. */
    deviceId?: string
}

/**
 * Mirrors a subset of multisig's `HandoffPollDetail`, redeclared structurally to
 * keep the type dependency one-way (multisig -> signing).
 */
export type HandoffPollDetail = {
    id?: string
    status: string
    fail_reason_display: Nullable<string>
    transaction_lists: Array<{
        raw_transactions: string[]
        responses: Array<{
            address: string
            response: string
            signatures?: Nullable<Nullable<string>[]>
        }>
    }>
}

/** Built by the resolver hook so these functions stay plain and unit-testable. */
export type ResolverMessages = {
    declined: string
    expired: string
    failed: string
    noTransactions: string
    deliveryFailed: string
    assemblyFailed: (reason: string) => string
}

/** Why a handoff poll ended in a terminal failure (non-fatal to the app). */
export type HandoffErrorReason =
    | { kind: 'no-transactions' }
    | { kind: 'assembly-failed'; detail: string }
    | { kind: 'backend-failed'; displayReason: Nullable<string> }
    | { kind: 'session-disconnected' }

/** Every variant but `keep-polling` is terminal, delivered exactly once. */
export type HandoffPollOutcome =
    | { kind: 'keep-polling' }
    | { kind: 'ready'; assembledBytes: Uint8Array[] }
    | { kind: 'soft-reject'; reason: 'declined' | 'expired' }
    | { kind: 'error'; reason: HandoffErrorReason }

/** Terminal outcomes: everything `classifyHandoffPoll` returns but `keep-polling`. */
export type TerminalHandoffOutcome = Exclude<
    HandoffPollOutcome,
    { kind: 'keep-polling' }
>

/**
 * Narrower than {@link PendingWalletConnectHandoff} so non-WC consumers can
 * reuse the classification logic without fabricating WC-only fields.
 */
export type HandoffAssemblyContext = {
    /** Picks the chain whose multisig adapter assembles the envelopes. */
    scope: ChainScope
    multisigAddress: string
    msigMetadata: { version: number; threshold: number; addresses: string[] }
    expectedRawTransactionsBase64: string[]
}

/**
 * How the resolver answers the WalletConnect peer. Injected from the app layer
 * so the pipeline carries no WalletConnect dependency, and keyed by the
 * serializable `clientId` / `payloadId` so it works for a rehydrated
 * (post-kill) handoff that has no in-memory closures. All three are
 * best-effort: a peer whose session is gone simply no-ops.
 */
export type HandoffPeerDelivery = {
    /** `approveRequest` with the assembled result array. May throw (dead session). */
    deliverResult: (
        clientId: string,
        payloadId: number,
        result: Nullable<string>[],
    ) => Promise<void>
    /** Clean soft-reject (decline / expired), no connection-error banner. */
    deliverSoftReject: (
        clientId: string,
        payloadId: number,
        error: Error,
    ) => Promise<void>
    /** Terminal error reject, raising the connection-error banner. */
    deliverError: (
        clientId: string,
        payloadId: number,
        error: Error,
    ) => Promise<void>
}

export type ResolveHandoffOutcomeArgs = {
    outcome: TerminalHandoffOutcome
    handoff: PendingWalletConnectHandoff
    messages: ResolverMessages
    delivery: HandoffPeerDelivery
    /** Best-effort backend notification; a rejection is logged, not surfaced. */
    markConfirmed: (input: {
        scope: ChainScope
        deviceId: string
        signRequestIds: string[]
    }) => Promise<void>
    /**
     * Best-effort cancel of the proposer's own backend sign request, called on
     * terminal failures (`error`, including a failed delivery of assembled
     * bytes, and `soft-reject`/`expired`). Nothing else terminalizes the
     * backend record when the dApp is gone, and the pending inbox reads
     * backend status; without this the request sits at pending/submitting
     * forever. NOT called on a delivered `ready` (success) or on
     * `soft-reject`/`declined` (a participant decline is already terminal on
     * the backend). A rejection is logged, not surfaced.
     */
    cancelRequest?: () => Promise<void>
}

/**
 * Side-effecting collaborators a multisig-handoff completion needs. Injected so
 * the orchestration stays a pure function of its inputs, unit-testable without
 * React, the node, or the multisig API, and so each consumer supplies only its own
 * submission and status semantics.
 */
export type MultisigHandoffCompletionDeps = {
    /**
     * Submit the assembled composite-multisig bytes to the chain and return the
     * resulting transaction ids. The consumer owns how the assembled signatures
     * are interleaved with any pre-signed slots and grouped for submission;
     * a throw here is treated as a terminal submission failure.
     */
    submit: (assembledBytes: Uint8Array[]) => Promise<string[]>
    /**
     * Durably record the group's tx ids the moment they're known: when
     * `submit` resolves (before any other post-submit side effect), or from an
     * `unknown-outcome` throw's deterministic ids so the retained handoff is
     * crash-safe. The consumer persists them so a crash between submission and
     * cleanup can't re-submit on relaunch (see `alreadySubmittedTxIds`).
     * Synchronous by design: a local store write, not a network call.
     * Best-effort.
     */
    recordSubmitted?: (txIds: string[]) => void
    /** Best-effort: tell the backend the wallet submitted, so it won't broadcast. */
    markConfirmed: () => Promise<void>
    /**
     * Best-effort: cancel the still-live sign-request (a proposer decline) on a
     * terminal failure, so a pending-signatures sheet / inbox go terminal
     * instead of lingering. May legitimately fail once threshold is met.
     */
    decline: () => Promise<void>
    /**
     * Drop the handoff from its registry once terminally resolved. Not called
     * on an `unknown-outcome` submit; the handoff is retained for
     * reconciliation.
     */
    removeHandoff: () => void
    /** Surface a terminal failure to the user (e.g. a localized toast). */
    reportError: (error: unknown) => void
    /** Record a successful submission (with the resulting tx ids). Best-effort. */
    onSubmitted: (txIds: string[]) => Promise<void>
    /** Record a clean soft-reject (user declined / request expired). Best-effort. */
    onSoftRejected: (reason: 'declined' | 'expired') => Promise<void>
    /** Record a terminal failure. Best-effort. */
    onFailed: () => Promise<void>
}

export type CompleteMultisigHandoffArgs = {
    outcome: TerminalHandoffOutcome
    deps: MultisigHandoffCompletionDeps
    /**
     * Tx ids persisted by `recordSubmitted` in a previous session. When set,
     * the transactions are already on chain: never submit again (the node would
     * reject the duplicate and the failure path would flip a landed swap to
     * "failed"), and ignore whatever the poll now says; a post-crash
     * `expired`/`failed` status just means mark-confirmed never made it.
     * Only the best-effort post-submit tail is replayed.
     */
    alreadySubmittedTxIds?: string[]
}

/**
 * `minTxnFee` is in the native asset's base units. `pqMultiplier` multiplies
 * the fee when the effective signer is post-quantum.
 */
export type ChainFeeConfig = {
    minTxnFee: bigint
    pqMultiplier: bigint
}

export type UseSuggestedMinFeeQueryResult = {
    /** Native base units; `undefined` until the first successful load, kept when a later refetch fails. */
    suggestedMinFee: Optional<bigint>
    isPending: boolean
    isError: boolean
}

export type FetchSuggestedMinFeeOptions = {
    /** Returned instead of throwing when the fetch fails. */
    fallback?: bigint
}

export type FetchSuggestedMinFee = (
    options?: FetchSuggestedMinFeeOptions,
) => Promise<bigint>

/**
 * The chain-specific legs of planning a signature request; registered by the
 * chain package.
 */
export interface PlannerChainAdapter {
    chainId: ChainId

    /** Synchronous: callers depend on a thrown error surfacing in the same tick. */
    resolveDappRequest(
        request: DappSignRequest,
        context: DappResolveContext,
    ): DappResolveResult
    enqueueDappRequest(
        resolved: DappResolveResult,
        transport: ExternalSignTxnTransport,
        deps: EnqueueDappRequestDeps,
    ): Promise<Nullable<TransactionSignRequest>>

    minFeeForSender(params: ResolveMinFeeForSenderParams): bigint
    /**
     * React hooks, run in the caller's render; the imperative fetch shares the
     * query's cache and staleness.
     */
    useFeeConfig: () => ChainFeeConfig
    useSuggestedMinFeeQuery: () => UseSuggestedMinFeeQueryResult
    useFetchSuggestedMinFee: () => FetchSuggestedMinFee
    /**
     * A React hook giving the minimum fee for a transaction `senderAddress`
     * sends, from live network fee parameters and remote config.
     */
    useMinFeeForSender(senderAddress: Optional<string>): MinFeeForSenderResult
    /**
     * A React hook giving the group fee assigner. It reads accounts at call
     * time, and its network fee fetch never throws. The assigner raises
     * underfunded fees on the signable slots and returns the group unchanged,
     * by reference, when nothing needs raising.
     * @throws InvalidSignableDataError when a fee must be raised but the group is invalid as received.
     */
    useAssignFeeToGroup(): AssignFeeToGroup
    /** Wire bytes without the signing-domain prefix, as the multisig backend stores them. */
    unsignedTransactionBytesOf(signed: SignedTransaction): Uint8Array
    reviewGroupFees(
        transactions: TransactionNative[],
        signableAddresses: Set<string>,
    ): GroupFeeReview

    computeBalanceImpact(
        transactions: TransactionNative[],
        userAddresses: Set<string>,
    ): BalanceImpact
    /** Whether the group moves funds the top-level transactions don't reveal. */
    needsSimulation(transactions: TransactionNative[]): boolean
    /** The transactions a simulated run of `groupTxs` reveals beyond its top level. */
    simulateGroup(
        groupTxs: UnsignedTransaction[],
        scope: ChainScope,
    ): Promise<TransactionNative[]>

    /** The bytes a program signature must cover. */
    programPayload(program: Uint8Array): Uint8Array
    /** @throws when the signature does not verify against `signerAddress`. */
    encodeProgramAccount(
        program: Uint8Array,
        sig: Uint8Array,
        signerAddress: string,
    ): Uint8Array

    /**
     * Checks the FULL payload. A cosigner holds only a subset of the group,
     * so `isCosigner` is the one sanctioned relaxation.
     */
    validateGroup(
        transactions: UnsignedTransaction[],
        options: { isCosigner: boolean },
    ): void
    /**
     * The group as the chain's own signers read it.
     * @throws InvalidSignableDataError when a payload isn't this chain's.
     */
    readTransactionsData(
        data: UnsignedTransactionsSignableData,
    ): ChainSignerTransactions
    /**
     * The account each of `request.txs` signs for, when the chain groups its
     * chain-neutral requests that way rather than by planned signer; the
     * pipeline then follows that account's rekey once. Undefined otherwise.
     * @throws InvalidSignableDataError when a signer override names an
     * account the transaction can't be signed for.
     */
    signedForAddresses(
        request: UnsignedTransactionSignRequest,
    ): Optional<string[]>
    /**
     * The chain data of a group {@link signedForAddresses} keys by account:
     * `indices` are the group's slots in `request.txs`.
     */
    signableGroupChainData(
        request: UnsignedTransactionSignRequest,
        indices: number[],
    ): object
    /** The facts the request's source sent beside `txs`, read from its `chainData`. */
    reviewGroupOf(request: UnsignedTransactionSignRequest): ReviewGroup
    /** `facts` as this chain keeps them in a request's `chainData`. */
    signRequestChainData(facts: SignRequestGroupFacts): unknown
    /**
     * What a request handed off to a multisig sign request needs to answer its
     * dApp after an app kill. Undefined when no dApp waits on the answer.
     */
    handoffDeliveryOf(
        request: UnsignedTransactionSignRequest,
    ): Optional<
        Omit<NonNullable<SourceMetadata['handoffDelivery']>, 'clientId'>
    >
    mergeSigningResults(results: SigningResult[]): SigningResult
    /**
     * A transaction result as the chain's wire-encoded signed transactions,
     * in request order. A slot nothing signed is `null`.
     * @throws TransportError when the result carries no transactions.
     */
    signedTransactionsOf(
        result: SigningResult,
        scope: ChainScope,
    ): Nullable<SignedTransaction>[]

    /**
     * The signed-transaction envelope for `transaction`. Unsigned when
     * `signature` is absent; the authorizing signer is recorded only when
     * `signerAddress` differs from the sender, so the node can find the key
     * that signed.
     */
    assembleSignedTransaction(
        transaction: UnsignedTransaction,
        signature?: { sig: Uint8Array; signerAddress: string },
    ): SignedTransaction

    createMultisigStrategy(
        options: CreateMultisigStrategyOptions,
    ): SigningStrategy
    signMultisigGroups(input: MultisigSignerInput): Promise<SigningResult[]>
    createMultisigProposeTransport(
        proposeSignRequest: ProposeSignRequestFn,
        capturedScope: ChainScope,
        getMsigMetadata: GetMsigMetadataFn,
        getDeviceId: GetDeviceIdFn,
        createDraftSignRequest?: CreateDraftSignRequestFn,
    ): DataTransport
    createMultisigCosignTransport(
        addSignatures: AddSignaturesFn,
        capturedScope: ChainScope,
    ): DataTransport
    /** Removes and returns the stashed context; call once, after the bootstrap propose succeeded. */
    takeDraftProposeContext(draftLocalId: string): Optional<DraftProposeContext>
    classifyHandoffPoll(
        detail: HandoffPollDetail,
        context: HandoffAssemblyContext,
    ): Promise<HandoffPollOutcome>
    resolveHandoffOutcome(args: ResolveHandoffOutcomeArgs): Promise<void>
    completeMultisigHandoff(args: CompleteMultisigHandoffArgs): Promise<void>
    isSignRequestMultisigUnsignable(
        request: SignRequest,
        accounts: WalletAccount[],
    ): boolean
}

const plannerRegistry =
    createChainAdapterRegistry<PlannerChainAdapter>('planner')
let plannersForHooks: readonly PlannerChainAdapter[] | undefined

export const plannerChainAdapters: ChainAdapterRegistry<PlannerChainAdapter> = {
    ...plannerRegistry,
    register: adapter => {
        if (
            isDebug &&
            plannersForHooks &&
            !plannersForHooks.includes(adapter)
        ) {
            throw new Error(
                `The ${adapter.chainId} planner registered after planner hooks first ran; chains must register before React mounts`,
            )
        }
        plannerRegistry.register(adapter)
    },
    reset: () => {
        plannerRegistry.reset()
        plannersForHooks = undefined
    },
}

/**
 * Every registered planner, in registration order, fixed at first use. A hook
 * that runs each planner's hook from this list calls the same hooks on every
 * render whatever chain it serves. Bootstrap registers every chain before
 * React mounts; a debug build throws if a planner registers later.
 */
export const registeredPlanners = (): readonly PlannerChainAdapter[] => {
    plannersForHooks ??= plannerRegistry.list()
    return plannersForHooks
}

export const plannerAdapterForScope = (
    scope: ChainScope,
): PlannerChainAdapter => plannerChainAdapters.get(scope.chainId)

/** The local-key signing legs; the KMS primitive is chosen by scheme, never by account type. */
export interface LocalKeySignerChainAdapter {
    chainId: ChainId

    /**
     * Leaves slots outside `indexesToSign` unsigned. Signs with `account` as
     * given and never follows rekey.
     */
    signTransactions(
        deps: LocalKeySigningDeps,
        transactions: UnsignedTransaction[],
        indexesToSign: number[],
        account: WalletAccount,
    ): Promise<SignedTransaction[]>
    createStrategy(options: LocalKeyStrategyOptions): SigningStrategy
    signGroups(input: LocalKeySignerInput): Promise<SigningResult[]>
}

export const localKeySignerChainAdapters =
    createChainAdapterRegistry<LocalKeySignerChainAdapter>('local-key signer')

export const messageSignerChainAdapters =
    createChainAdapterRegistry<MessageSignerChainAdapter>('message signer')

export const localKeySignerAdapterFor = (
    scope: ChainScope,
): LocalKeySignerChainAdapter => localKeySignerChainAdapters.get(scope.chainId)

/** The suggested minimum, so no fee override, on a chain with no planner. */
export const resolveMinFeeForSender = (
    chainId: ChainId,
    params: ResolveMinFeeForSenderParams,
): bigint =>
    plannerChainAdapters.has(chainId)
        ? plannerChainAdapters.get(chainId).minFeeForSender(params)
        : params.suggestedMinFee

const NO_BALANCE_IMPACT: BalanceImpact = {
    deltas: [],
    totalFeeMicroAlgos: 0n,
    hasCloseRemainder: false,
    closedAssetIds: [],
    createdAssets: [],
}

/** No impact on a chain with no planner: there is nothing to compute it from. */
export const computeBalanceImpact = (
    chainId: ChainId,
    transactions: TransactionNative[],
    userAddresses: Set<string>,
): BalanceImpact =>
    plannerChainAdapters.has(chainId)
        ? plannerChainAdapters
              .get(chainId)
              .computeBalanceImpact(transactions, userAddresses)
        : NO_BALANCE_IMPACT

/** False on a chain with no planner: nothing there needs simulating. */
export const needsSimulation = (
    chainId: ChainId,
    transactions: TransactionNative[],
): boolean =>
    plannerChainAdapters.has(chainId) &&
    plannerChainAdapters.get(chainId).needsSimulation(transactions)

export const encodeProgramAccount = (
    chainId: ChainId,
    program: Uint8Array,
    sig: Uint8Array,
    signerAddress: string,
): Uint8Array =>
    plannerChainAdapters
        .get(chainId)
        .encodeProgramAccount(program, sig, signerAddress)

export const classifyHandoffPoll = (
    detail: HandoffPollDetail,
    context: HandoffAssemblyContext,
): Promise<HandoffPollOutcome> =>
    plannerAdapterForScope(context.scope).classifyHandoffPoll(detail, context)

export const completeMultisigHandoff = (
    chainId: ChainId,
    args: CompleteMultisigHandoffArgs,
): Promise<void> =>
    plannerChainAdapters.get(chainId).completeMultisigHandoff(args)

/** False on a chain with no planner: it has no multisig to be unsignable. */
export const isSignRequestMultisigUnsignable = (
    request: SignRequest,
    accounts: WalletAccount[],
): boolean => {
    const chainId = chainIdOfSignRequest(request)
    return (
        plannerChainAdapters.has(chainId) &&
        plannerChainAdapters
            .get(chainId)
            .isSignRequestMultisigUnsignable(request, accounts)
    )
}
