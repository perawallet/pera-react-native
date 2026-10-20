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

import type { Optional } from '@perawallet/wallet-core-shared'
import type {
    ReviewGroup,
    SignRequestGroupFacts,
    SourceMetadata,
    UnsignedTransactionSignRequest,
    UnsignedTransactionsSignableData,
} from '@perawallet/wallet-core-signing'

/** What an Algorand sign request carries in its `chainData`. */
export type AlgorandRequestData = SignRequestGroupFacts & {
    /**
     * WalletConnect JSON-RPC request id, set only by the WalletConnect source,
     * so the multisig sync-flow handoff can answer the dApp after an app kill.
     */
    payloadId?: number
    /** Full atomic-group length. The WalletConnect result array is null-padded to it. */
    totalLength?: number
}

/** An Algorand group's members the wallet signs, and its bytes as an external request sent them. */
export type AlgorandGroupData = {
    indicesToSign: number[]
    rawTransactionsBase64?: string[]
}

type AlgorandRequestChainData = { algorand?: AlgorandRequestData }

type AlgorandGroupChainData = { algorand?: AlgorandGroupData }

export const algorandRequestChainData = (
    data: AlgorandRequestData,
): AlgorandRequestChainData => ({ algorand: data })

// Only Algorand's sources and planner build a request on this chain, so its
// `chainData` is the shape they wrote.
export const algorandRequestDataOf = (
    request: UnsignedTransactionSignRequest,
): Optional<AlgorandRequestData> =>
    (request.chainData as Optional<AlgorandRequestChainData>)?.algorand

export const algorandGroupDataOf = (
    data: UnsignedTransactionsSignableData,
): Optional<AlgorandGroupData> =>
    (data.chainData as Optional<AlgorandGroupChainData>)?.algorand

// The group is `request.txs` at `indices`, so it signs every one of its own slots.
export const algorandSignableGroupChainData = (
    request: UnsignedTransactionSignRequest,
    indices: number[],
): AlgorandGroupChainData => {
    const raw = algorandRequestDataOf(request)?.rawTransactionsBase64
    return {
        algorand: {
            indicesToSign: indices.map((_, i) => i),
            ...(raw && { rawTransactionsBase64: indices.map(i => raw[i]) }),
        },
    }
}

export const algorandReviewGroupOf = (
    request: UnsignedTransactionSignRequest,
): ReviewGroup => {
    const facts = algorandRequestDataOf(request)
    const groupContext = facts?.groupContext
    return {
        transactions: groupContext ?? request.txs,
        groupContext,
        signableIndices: facts?.signableIndices,
        signerOverrides: facts?.signerOverrides,
        feeAdjustments: facts?.feeAdjustments,
    }
}

export const algorandHandoffDeliveryOf = (
    request: UnsignedTransactionSignRequest,
): Optional<
    Omit<NonNullable<SourceMetadata['handoffDelivery']>, 'clientId'>
> => {
    const facts = algorandRequestDataOf(request)
    if (facts?.payloadId === undefined) return undefined
    return {
        payloadId: facts.payloadId,
        indicesToSign: facts.signableIndices ?? [],
        totalLength: facts.totalLength ?? 0,
    }
}
