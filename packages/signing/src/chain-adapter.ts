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
    LEGACY_CHAIN_ID,
    scopeForLegacyNetwork,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    Arc0001ResolveContext,
    Arc0001ResolveResult,
    Arc0001SignTxnsRequest,
    PeraDisplayableTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-config'
import type { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    FeeAdjustment,
    SignRequest,
    TransactionSignRequest,
    TransactionWarning,
} from './models'
import type { ExternalSignTxnTransport } from './hooks/useEnqueueArc0001SignRequest'
import type {
    AnalysisContext,
    SignableAnalysis,
    SignableGroup,
    SigningResult,
} from './pipeline/types'

export type RequestStructure = 'single' | 'list'

export type SingleTransactionItem = {
    type: 'transaction'
    transaction: PeraDisplayableTransaction
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
    groupIndex: number
}

export type TransactionListItem = SingleTransactionItem | GroupTransactionItem

export type DelegatedUnsignableReason = {
    kind: 'authMissing' | 'authIsWatch'
    senderAddress: string
    authAddress: string
}

export type ArbitraryDataDisplay =
    | { kind: 'text'; text: string }
    | { kind: 'hex'; hex: string }

/** The chain-specific legs of reviewing a sign request; registered by the chain package. */
export interface ReviewerChainAdapter {
    chainId: ChainId
    analyze(
        group: SignableGroup,
        context: AnalysisContext,
    ): Promise<SignableAnalysis>
    createTransactionListItems(
        transactions: PeraDisplayableTransaction[],
        signableIndices?: ReadonlySet<number>,
    ): TransactionListItem[]
    classifyRequestStructure(listItems: TransactionListItem[]): RequestStructure
    /** `authorizerByIndex` keys index into `transactions`. */
    aggregateTransactionWarnings(
        transactions: PeraDisplayableTransaction[],
        userAccountAddresses: Set<string>,
        signableAddresses: Set<string>,
        authorizerByIndex?: Map<number, string>,
    ): TransactionWarning[]
    resolveAllSignerAddresses(request: SignRequest): string[]
    getRekeyedUnsignableReason(
        request: SignRequest,
        accounts: WalletAccount[],
    ): DelegatedUnsignableReason | null
    /** Never throws; anything that isn't cleanly printable comes back as hex. */
    decodeArbitraryDataForDisplay(data: string): ArbitraryDataDisplay
}

export const reviewerChainAdapters =
    createChainAdapterRegistry<ReviewerChainAdapter>('reviewer')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const reviewerAdapterFor = (network: Network): ReviewerChainAdapter =>
    reviewerChainAdapters.get(scopeForLegacyNetwork(network).chainId)

type WithChain<F extends (...args: never[]) => unknown> = (
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

export const getRekeyedUnsignableReason: WithChain<
    ReviewerChainAdapter['getRekeyedUnsignableReason']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).getRekeyedUnsignableReason(...args)

export const decodeArbitraryDataForDisplay: WithChain<
    ReviewerChainAdapter['decodeArbitraryDataForDisplay']
> = (chainId, ...args) =>
    reviewerChainAdapters.get(chainId).decodeArbitraryDataForDisplay(...args)

export type ResolveMinFeeForSenderParams = {
    senderAddress: string
    /** All wallet accounts, used to resolve the effective signer (auth account) */
    accounts: WalletAccount[]
    /** Network suggested minimum fee in µAlgo (algod suggestedParams.minFee) */
    suggestedMinFee: bigint
    /** Remote-config base minimum txn fee in µAlgo */
    configMinTxnFee: bigint
    /** Remote-config PQ fee multiplier */
    pqMultiplier: bigint
}

export type AssignFeeToGroupParams = {
    /** Full atomic payload (groupContext space), NOT just the signable subset */
    transactions: PeraTransaction[]
    /** Indices into `transactions` the wallet will sign; defaults to all */
    signableIndices?: number[]
    /** Subset-position → authorizer address (ARC-0001 `signers`) */
    signerOverrides?: Map<number, string>
}

export type AssignMinimumFeesToGroupResult = {
    /** Same array reference as input when nothing was adjusted */
    transactions: PeraTransaction[]
    /** Empty when nothing was adjusted */
    adjustments: FeeAdjustment[]
}

export type AssignFeeToGroup = (
    params: AssignFeeToGroupParams,
) => Promise<AssignMinimumFeesToGroupResult>

/** What the planner cannot read itself because it lives in React or a store. */
export type AssignFeeToGroupDeps = {
    /** Read at call time: a WalletConnect call can outlive the component that started it. */
    accounts: WalletAccount[]
    /** Network suggested minimum fee in µAlgo; must resolve rather than throw. */
    fetchSuggestedMinFee: () => Promise<bigint>
    /** Remote-config base minimum txn fee in µAlgo */
    configMinTxnFee: bigint
    pqMultiplier: bigint
}

export type EnqueueArc0001SignRequestDeps = {
    assignFeeToGroup: AssignFeeToGroup
    addSignRequest: (request: SignRequest) => void
    removeSignRequest: (request: SignRequest) => void
}

export type BalanceImpactDelta = {
    /** Asset id; `'0'` denotes the native ALGO balance. */
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

/**
 * The chain-specific legs of planning a signature request; registered by the
 * chain package. Shaped after what the Algorand code needs today.
 */
export interface PlannerChainAdapter {
    chainId: ChainId

    /** Synchronous: callers depend on a thrown error surfacing in the same tick. */
    resolveArc0001SignTxnRequest(
        request: Arc0001SignTxnsRequest,
        context: Arc0001ResolveContext,
    ): Arc0001ResolveResult
    enqueueArc0001SignRequest(
        resolved: Arc0001ResolveResult,
        transport: ExternalSignTxnTransport,
        deps: EnqueueArc0001SignRequestDeps,
    ): Promise<Nullable<TransactionSignRequest>>

    /** Minimum fee in µAlgo a transaction from `senderAddress` must carry. */
    resolveMinFeeForSender(params: ResolveMinFeeForSenderParams): bigint
    /**
     * Raises underfunded fees on the signable slots and returns the group
     * unchanged, by reference, when nothing needs raising.
     * @throws InvalidSignableDataError when a fee must be raised but the group is invalid as received.
     */
    assignFeeToGroup(
        params: AssignFeeToGroupParams,
        deps: AssignFeeToGroupDeps,
    ): Promise<AssignMinimumFeesToGroupResult>
    calculateTotalFee(
        transactions: PeraDisplayableTransaction[],
        signableAddresses: Set<string>,
    ): Decimal
    detectHighGroupFee(
        transactions: PeraDisplayableTransaction[],
        signableAddresses: Set<string>,
    ): Nullable<TransactionWarning>

    computeBalanceImpact(
        transactions: PeraDisplayableTransaction[],
        userAddresses: Set<string>,
    ): BalanceImpact
    /** Whether the group moves funds the top-level transactions don't reveal. */
    needsSimulation(transactions: PeraDisplayableTransaction[]): boolean
    /** Inner transactions of an unsigned simulation of `groupTxs`. */
    simulateInnerTransactions(
        groupTxs: PeraTransaction[],
        network: Network,
    ): Promise<PeraDisplayableTransaction[]>

    /** The bytes a delegated logic-sig signature must cover. */
    programSigningPayload(program: Uint8Array): Uint8Array
    encodeDelegatedLsig(program: Uint8Array, sig: Uint8Array): Uint8Array
    /** @throws when the signature does not verify against `signerAddress`. */
    encodeDelegatedLsigAccount(
        program: Uint8Array,
        sig: Uint8Array,
        signerAddress: string,
    ): Uint8Array

    /** Checks the FULL payload, not the signable subset. */
    validateTransactionGroupIntegrity(transactions: PeraTransaction[]): void
    /** The only sanctioned relaxation: a co-signer holds just a subset of the group. */
    validateCosignSubsetIntegrity(transactions: PeraTransaction[]): void
    mergeSigningResults(results: SigningResult[]): SigningResult
}

export const plannerChainAdapters =
    createChainAdapterRegistry<PlannerChainAdapter>('planner')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const plannerAdapterFor = (network: Network): PlannerChainAdapter =>
    plannerChainAdapters.get(scopeForLegacyNetwork(network).chainId)

// For callers with no network in hand: every legacy network maps to this chain.
export const legacyPlannerAdapter = (): PlannerChainAdapter =>
    plannerChainAdapters.get(LEGACY_CHAIN_ID)

export const resolveMinFeeForSender = (
    params: ResolveMinFeeForSenderParams,
): bigint => legacyPlannerAdapter().resolveMinFeeForSender(params)

export const computeBalanceImpact = (
    transactions: PeraDisplayableTransaction[],
    userAddresses: Set<string>,
): BalanceImpact =>
    legacyPlannerAdapter().computeBalanceImpact(transactions, userAddresses)

export const encodeDelegatedLsigAccount = (
    program: Uint8Array,
    sig: Uint8Array,
    signerAddress: string,
): Uint8Array =>
    legacyPlannerAdapter().encodeDelegatedLsigAccount(
        program,
        sig,
        signerAddress,
    )
