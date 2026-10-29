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

import type { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    createChainAdapterRegistry,
    type ChainId,
    type ChainScope,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'

import {
    PeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * A chain's quote for one inbox send. Only the adapter that minted it in
 * `fetchSendSummary` reads it; it re-validates before building because the
 * quote decides a headlessly signed payment.
 */
export type AssetInboxQuote = { readonly __assetInboxQuote: true }

/** Mints an {@link AssetInboxQuote}; called only by a chain's inbox adapter. */
export const toAssetInboxQuote = (quote: object): AssetInboxQuote =>
    quote as AssetInboxQuote

export type InboxSendTxsParams = {
    scope: ChainScope
    sender: string
    receiver: string
    assetId: bigint
    /** Base units. */
    amount: bigint
    /** The quote the send was confirmed against, exactly as fetched. */
    quote: AssetInboxQuote
    /**
     * Base units of the native asset: the PQ-aware minimum fee for the
     * sender's own transactions.
     */
    senderMinFee: bigint
}

export type InboxClaimTxsParams = {
    scope: ChainScope
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

/** An asset waiting for the receiver in the chain's inbox. */
export interface AssetInboxRequest {
    id?: string
    /** The receiver's inbox account address, or null if none exists yet. */
    inboxAddress: Nullable<string>
    /** Total amount across all senders, in base units */
    totalAmount: Decimal
    asset: PeraAsset
    usdValue: Nullable<Decimal>
    /** Native asset gain on claim, in base units */
    nativeGainOnClaim: Decimal
    /** Native asset gain on reject, in base units */
    nativeGainOnReject: Decimal
    senders: {
        count: number
        results: Array<{
            sender: { address: string; name: Nullable<string> }
            /** Sender's amount, in base units */
            amount: Decimal
        }>
    }
    insufficientNativeForClaiming: boolean
    insufficientNativeForRejecting: boolean
    shouldUseFundsBeforeClaiming: boolean
    shouldUseFundsBeforeRejecting: boolean
}

export type AssetInboxSendSummary = {
    /** Goes back unchanged as {@link InboxSendTxsParams.quote}. */
    quote: AssetInboxQuote
    /** What the signed funding payment carries, in native base units. */
    fundingAmount: bigint
}

/**
 * Holds assets for a receiver who cannot accept them yet, until they claim or
 * reject them (ARC-59 on Algorand).
 */
export interface AssetInboxSendFlow {
    fetchRequests(params: {
        scope: ChainScope
        address: string
    }): Promise<AssetInboxRequest[]>
    fetchSendSummary(params: {
        scope: ChainScope
        receiver: string
        assetId: string
    }): Promise<AssetInboxSendSummary>
    buildSendTxs(params: InboxSendTxsParams): Promise<UnsignedTransaction[]>
    buildClaimTxs(params: InboxClaimTxsParams): Promise<UnsignedTransaction[]>
    buildRejectTxs(params: InboxRejectTxsParams): Promise<UnsignedTransaction[]>
}

export type TransferTxsParams = {
    scope: ChainScope
    sender: string
    receiver: string
    /** The chain's native asset id, or a token id. */
    assetId: string
    /** Base units. */
    amount: bigint
    note?: string
    /** Sweeps the sender's whole native balance to the receiver. */
    isCloseAccount?: boolean
    /**
     * Base units of the native asset. Omitted, the chain sizes the fee; the
     * caller passes it only when its PQ-aware minimum exceeds that.
     */
    fee?: bigint
}

export type ExpressTransferTxsParams = {
    scope: ChainScope
    sender: string
    receiver: string
    assetId: bigint
    /** Base units. */
    amount: bigint
    /** Base units of the native asset the receiver needs before it can opt in; 0n skips the funding leg. */
    funding: bigint
    /** Base units of the native asset; see {@link TransferTxsParams.fee}. */
    senderFee?: bigint
    /** Base units of the native asset; see {@link TransferTxsParams.fee}. */
    receiverFee?: bigint
}

export type AssetOptInTxsParams = {
    scope: ChainScope
    sender: string
    assetId: bigint
}

export type AssetOptOutTxsParams = {
    scope: ChainScope
    optOuts: Array<{ sender: string; assetId: bigint; creator: string }>
}

export type DelegationTxParams = {
    scope: ChainScope
    sourceAddress: string
    /** Signs for `sourceAddress` once the delegation lands. */
    authorityAddress: string
    /** Base units of the native asset: the PQ-aware minimum for the effective signer. */
    minFee: bigint
}

export type KeyRegistrationTxParams = {
    scope: ChainScope
    sender: string
    note?: Uint8Array
    /** Base units of the native asset. */
    fee?: bigint
} & (
    | { kind: 'offline' }
    | {
          kind: 'online'
          voteKey: Uint8Array
          selectionKey: Uint8Array
          stateProofKey: Uint8Array
          voteFirst: bigint
          voteLast: bigint
          voteKeyDilution: bigint
      }
)

/**
 * The chain-specific legs of the send flow; registered by the chain package.
 * Every optional feature is an object so it can be resolved without a `this`
 * binding and fails closed when a chain lacks it.
 */
export interface SendFlowChainAdapter {
    chainId: ChainId
    buildTransferTxs(params: TransferTxsParams): Promise<UnsignedTransaction[]>
    /** Fund the receiver, opt it in, then transfer, in one group. */
    express?: {
        buildTxs(
            params: ExpressTransferTxsParams,
        ): Promise<UnsignedTransaction[]>
    }
    assetInbox?: AssetInboxSendFlow
    assetHolding?: {
        buildOptInTxs(
            params: AssetOptInTxsParams,
        ): Promise<UnsignedTransaction[]>
        buildOptOutTxs(
            params: AssetOptOutTxsParams,
        ): Promise<UnsignedTransaction[]>
    }
    delegation?: {
        buildTx(params: DelegationTxParams): Promise<UnsignedTransaction>
    }
    /** The fee `transaction` pays as built, in base units of the native asset. */
    transactionFee(transaction: UnsignedTransaction): Decimal
}

export const sendFlowChainAdapters =
    createChainAdapterRegistry<SendFlowChainAdapter>('send flow')

type SendFlowFeature = 'express' | 'assetInbox' | 'assetHolding' | 'delegation'

/** Throws {@link PeraServiceUnavailableError} when the chain lacks the feature. */
export const sendFlowFeatureFor = <K extends SendFlowFeature>(
    scope: ChainScope,
    feature: K,
): NonNullable<SendFlowChainAdapter[K]> => {
    const value = sendFlowChainAdapters.get(scope.chainId)[feature]
    if (!value) throw new PeraServiceUnavailableError(scope)

    return value as NonNullable<SendFlowChainAdapter[K]>
}
