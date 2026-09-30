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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    createChainAdapterRegistry,
    LEGACY_CHAIN_ID,
    scopeForLegacyNetwork,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import type { SignRequest, TransactionWarning } from './models'
import type {
    AnalysisContext,
    SignableAnalysis,
    SignableGroup,
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

export type RekeyedUnsignableReason = {
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
    ): RekeyedUnsignableReason | null
    /** Never throws; anything that isn't cleanly printable comes back as hex. */
    decodeArbitraryDataForDisplay(data: string): ArbitraryDataDisplay
}

export const reviewerChainAdapters =
    createChainAdapterRegistry<ReviewerChainAdapter>('reviewer')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const reviewerAdapterFor = (network: Network): ReviewerChainAdapter =>
    reviewerChainAdapters.get(scopeForLegacyNetwork(network).chainId)

// Sign requests and history rows carry no chain yet, so the wrappers resolve
// the legacy chain.
const legacyAdapter = (): ReviewerChainAdapter =>
    reviewerChainAdapters.get(LEGACY_CHAIN_ID)

export const createTransactionListItems: ReviewerChainAdapter['createTransactionListItems'] =
    (...args) => legacyAdapter().createTransactionListItems(...args)

export const classifyRequestStructure: ReviewerChainAdapter['classifyRequestStructure'] =
    (...args) => legacyAdapter().classifyRequestStructure(...args)

export const aggregateTransactionWarnings: ReviewerChainAdapter['aggregateTransactionWarnings'] =
    (...args) => legacyAdapter().aggregateTransactionWarnings(...args)

export const resolveAllSignerAddresses: ReviewerChainAdapter['resolveAllSignerAddresses'] =
    (...args) => legacyAdapter().resolveAllSignerAddresses(...args)

export const getRekeyedUnsignableReason: ReviewerChainAdapter['getRekeyedUnsignableReason'] =
    (...args) => legacyAdapter().getRekeyedUnsignableReason(...args)

export const decodeArbitraryDataForDisplay: ReviewerChainAdapter['decodeArbitraryDataForDisplay'] =
    (...args) => legacyAdapter().decodeArbitraryDataForDisplay(...args)
