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
    scopeForLegacyNetwork,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import {
    PeraServiceUnavailableError,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export type InboxSendTxsParams = {
    network: Network
    sender: string
    receiver: string
    assetId: bigint
    /** Base units. */
    amount: bigint
    /**
     * The chain's quote for this inbox send, exactly as the app fetched it.
     * Opaque here; the adapter validates it before building.
     */
    summary: unknown
    /**
     * Base units of the native asset: the PQ-aware minimum fee for the
     * sender's own transactions.
     */
    senderMinFee: bigint
}

export type InboxClaimTxsParams = {
    network: Network
    sender: string
    assetId: bigint
    shouldClaimAlgo: boolean
    /** When null the adapter discovers the group's resources itself. */
    inboxAddress: Nullable<string>
    /** See {@link InboxSendTxsParams.senderMinFee}. */
    senderMinFee: bigint
}

export type InboxRejectTxsParams = InboxClaimTxsParams & {
    assetCreator: string
}

/**
 * Holds assets for a receiver who cannot accept them yet, until they claim or
 * reject them (ARC-59 on Algorand).
 */
export interface AssetInboxSendFlow {
    buildSendTxs(params: InboxSendTxsParams): Promise<PeraTransaction[]>
    buildClaimTxs(params: InboxClaimTxsParams): Promise<PeraTransaction[]>
    buildRejectTxs(params: InboxRejectTxsParams): Promise<PeraTransaction[]>
}

/** The chain-specific legs of the send flow; registered by the chain package. */
export interface SendFlowChainAdapter {
    chainId: ChainId
    assetInbox?: AssetInboxSendFlow
}

export const sendFlowChainAdapters =
    createChainAdapterRegistry<SendFlowChainAdapter>('send flow')

export const assetInboxFor = (network: Network): AssetInboxSendFlow => {
    const { assetInbox } = sendFlowChainAdapters.get(
        scopeForLegacyNetwork(network).chainId,
    )
    if (!assetInbox) throw new PeraServiceUnavailableError(network)

    return assetInbox
}
