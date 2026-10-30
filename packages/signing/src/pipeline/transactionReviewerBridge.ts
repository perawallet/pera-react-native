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

import { Decimal } from 'decimal.js'
import { chainAccountOf } from '@perawallet/wallet-core-accounts'
import {
    transactionReviewers,
    type ChainId,
    type DecodedTransactions,
    type ReviewContext,
    type TransactionReviewer,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    toBigInt,
    toError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    reviewerChainAdapters,
    type ReviewerChainAdapter,
} from '../chain-adapter'
import { InvalidSignableDataError, PipelineError } from './errors'
import type { AnalysisContext, DecodedGroup, SignableGroup } from './types'

/** The legs of a reviewer the signing machine runs on every group. */
export type GroupReviewer = Pick<
    ReviewerChainAdapter,
    'chainId' | 'decoder' | 'warnings' | 'policy'
>

// A chain's refusal is a fact about the payload, so retrying can't change it.
const toPipelineError = (error: unknown): PipelineError =>
    error instanceof PipelineError
        ? error
        : new InvalidSignableDataError(toError(error).message)

const heldAddressesOf = (context: AnalysisContext): string[] =>
    context.accounts.flatMap(
        account =>
            chainAccountOf(account, context.scope.chainId)?.address ?? [],
    )

const reviewContextOf = (
    group: SignableGroup,
    context: AnalysisContext,
): ReviewContext => ({
    scope: context.scope,
    heldAddresses: heldAddressesOf(context),
    // The wallet's own transports set the source type; a dApp payload can't.
    isWalletBuilt: group.source.type === 'local',
    capabilities: getProvider().chains.capabilities(context.scope.chainId),
})

/** Undefined for a group of data rather than transactions. */
const unsignedTransactionsOf = (
    group: SignableGroup,
): Optional<UnsignedTransaction[]> =>
    group.data.type === 'transactions' ? group.data.transactions : undefined

const toDecodedTransactions = (
    decoded: Pick<
        DecodedGroup,
        'totalFees' | 'signableAddresses' | 'transactions'
    >,
): DecodedTransactions => ({
    totalFees: new Decimal(decoded.totalFees.toString()),
    signableAddresses: decoded.signableAddresses,
    transactions: decoded.transactions ?? [],
})

/** Runs a chain-contract reviewer as the signing machine's group reviewer. */
export const bridgeTransactionReviewer = (
    reviewer: TransactionReviewer,
): GroupReviewer => ({
    chainId: reviewer.chainId,
    decoder: {
        decode: async (group, context) => {
            try {
                const transactions = unsignedTransactionsOf(group)
                if (!transactions) {
                    return {
                        totalFees: 0n,
                        signableAddresses: heldAddressesOf(context),
                        transactions: [],
                    }
                }
                const decoded = await reviewer.decoder.decode(
                    transactions,
                    reviewContextOf(group, context),
                )
                return {
                    totalFees: toBigInt(decoded.totalFees),
                    signableAddresses: decoded.signableAddresses,
                    transactions: decoded.transactions,
                }
            } catch (error) {
                throw toPipelineError(error)
            }
        },
    },
    warnings: {
        detect: (group, decoded, context) => {
            try {
                const transactions = unsignedTransactionsOf(group)
                if (!transactions) return []
                return reviewer.warnings.detect(
                    transactions,
                    toDecodedTransactions(decoded),
                    reviewContextOf(group, context),
                )
            } catch (error) {
                throw toPipelineError(error)
            }
        },
    },
    policy: {
        autoApproveLocal: analysis =>
            reviewer.policy.autoApproveLocal({
                ...toDecodedTransactions(analysis),
                warnings: analysis.warnings,
            }),
        ...(reviewer.policy.matchesApprovedPreview && {
            matchesApprovedPreview: reviewer.policy.matchesApprovedPreview.bind(
                reviewer.policy,
            ),
        }),
    },
})

/**
 * The signing package's own reviewer for a chain that registers one, else the
 * chain's `TransactionReviewer`. A chain with neither throws, so its requests
 * are refused rather than signed unreviewed.
 */
export const reviewerFor = (chainId: ChainId): GroupReviewer =>
    reviewerChainAdapters.has(chainId)
        ? reviewerChainAdapters.get(chainId)
        : bridgeTransactionReviewer(transactionReviewers.get(chainId))
