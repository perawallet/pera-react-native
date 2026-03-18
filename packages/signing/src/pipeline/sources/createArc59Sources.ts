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

import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { DataSource } from '../types'
import { createLocalSource } from './factories'

/**
 * Parameters for ARC59 send via inbox
 */
export interface Arc59SendSourceParams {
    /** Sender address */
    sender: string

    /** Receiver address */
    receiver: string

    /** Amount in base units */
    amount: bigint

    /** Asset ID to transfer */
    assetId: bigint

    /** Summary from API including fees and inner tx count */
    summary: {
        algoFundAmount: bigint
        minimumBalanceRequirement: bigint
        isArc59OptedIn: boolean
        innerTxCount: number
    }
}

/**
 * Parameters for ARC59 claim from inbox
 */
export interface Arc59ClaimSourceParams {
    /** Sender/claimer address */
    sender: string

    /** Asset ID to claim */
    assetId: bigint

    /** Whether to also claim any ALGO in the inbox */
    shouldClaimAlgo: boolean

    /** Whether the sender is already opted into the asset */
    isOptedIn: boolean
}

/**
 * Parameters for ARC59 reject from inbox
 */
export interface Arc59RejectSourceParams {
    /** Sender address */
    sender: string

    /** Asset ID to reject */
    assetId: bigint

    /** Whether to also claim any ALGO in the inbox */
    shouldClaimAlgo: boolean
}

/**
 * Dependencies for ARC59 sources
 */
export interface Arc59SourceDependencies {
    /** ARC59 app address */
    appAddress: string

    /** Build send via inbox transaction group */
    buildSendViaInboxTransactions: (
        params: Arc59SendSourceParams,
    ) => Promise<PeraTransaction[]>

    /** Build claim transaction group */
    buildClaimTransactions: (
        params: Arc59ClaimSourceParams,
    ) => Promise<PeraTransaction[]>

    /** Build reject transaction group */
    buildRejectTransactions: (
        params: Arc59RejectSourceParams,
    ) => Promise<PeraTransaction[]>

    /** Function to encode a transaction to bytes */
    encodeTransaction: (tx: PeraTransaction) => Uint8Array
}

/**
 * Create a source for ARC59 send via inbox.
 *
 * @param deps - Dependencies for building transactions
 * @returns A DataSource that builds ARC59 send transactions
 *
 * @example
 * const source = createArc59SendSource(deps)
 * const group = await source.getSignableData({
 *   sender: 'ABC...',
 *   receiver: 'XYZ...',
 *   amount: 100n,
 *   assetId: 123456n,
 *   summary: { algoFundAmount: 0n, ... },
 * })
 */
export const createArc59SendSource = (
    deps: Arc59SourceDependencies,
): DataSource<Arc59SendSourceParams> => {
    const { buildSendViaInboxTransactions, encodeTransaction } = deps

    return createLocalSource<Arc59SendSourceParams>(async params => {
        const transactions = await buildSendViaInboxTransactions(params)

        const rawTransactionsBase64 = transactions.map(tx =>
            encodeToBase64(encodeTransaction(tx)),
        )

        // All transactions in the group are signed by the sender
        const indicesToSign = transactions.map((_, index) => index)

        return {
            data: {
                type: 'transactions',
                transactions,
                rawTransactionsBase64,
                indicesToSign,
            },
            signerAddress: params.sender,
        }
    })
}

/**
 * Create a source for ARC59 claim from inbox.
 *
 * @param deps - Dependencies for building transactions
 * @returns A DataSource that builds ARC59 claim transactions
 *
 * @example
 * const source = createArc59ClaimSource(deps)
 * const group = await source.getSignableData({
 *   sender: 'ABC...',
 *   assetId: 123456n,
 *   shouldClaimAlgo: true,
 *   isOptedIn: false,
 * })
 */
export const createArc59ClaimSource = (
    deps: Arc59SourceDependencies,
): DataSource<Arc59ClaimSourceParams> => {
    const { buildClaimTransactions, encodeTransaction } = deps

    return createLocalSource<Arc59ClaimSourceParams>(async params => {
        const transactions = await buildClaimTransactions(params)

        const rawTransactionsBase64 = transactions.map(tx =>
            encodeToBase64(encodeTransaction(tx)),
        )

        // All transactions in the group are signed by the sender
        const indicesToSign = transactions.map((_, index) => index)

        return {
            data: {
                type: 'transactions',
                transactions,
                rawTransactionsBase64,
                indicesToSign,
            },
            signerAddress: params.sender,
        }
    })
}

/**
 * Create a source for ARC59 reject from inbox.
 *
 * @param deps - Dependencies for building transactions
 * @returns A DataSource that builds ARC59 reject transactions
 *
 * @example
 * const source = createArc59RejectSource(deps)
 * const group = await source.getSignableData({
 *   sender: 'ABC...',
 *   assetId: 123456n,
 *   shouldClaimAlgo: false,
 * })
 */
export const createArc59RejectSource = (
    deps: Arc59SourceDependencies,
): DataSource<Arc59RejectSourceParams> => {
    const { buildRejectTransactions, encodeTransaction } = deps

    return createLocalSource<Arc59RejectSourceParams>(async params => {
        const transactions = await buildRejectTransactions(params)

        const rawTransactionsBase64 = transactions.map(tx =>
            encodeToBase64(encodeTransaction(tx)),
        )

        // All transactions in the group are signed by the sender
        const indicesToSign = transactions.map((_, index) => index)

        return {
            data: {
                type: 'transactions',
                transactions,
                rawTransactionsBase64,
                indicesToSign,
            },
            signerAddress: params.sender,
        }
    })
}
