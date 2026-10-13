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
    type ChainId,
    type ChainScope,
    type PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'

import {
    PeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export type InboxSendTxsParams = {
    scope: ChainScope
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

/**
 * Holds assets for a receiver who cannot accept them yet, until they claim or
 * reject them (ARC-59 on Algorand).
 */
export interface AssetInboxSendFlow {
    buildSendTxs(params: InboxSendTxsParams): Promise<PeraTransaction[]>
    buildClaimTxs(params: InboxClaimTxsParams): Promise<PeraTransaction[]>
    buildRejectTxs(params: InboxRejectTxsParams): Promise<PeraTransaction[]>
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

export type RekeyTxParams = {
    scope: ChainScope
    sourceAddress: string
    rekeyToAddress: string
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
    buildTransferTxs(params: TransferTxsParams): Promise<PeraTransaction[]>
    /** Fund the receiver, opt it in, then transfer, in one group. */
    express?: {
        buildTxs(params: ExpressTransferTxsParams): Promise<PeraTransaction[]>
    }
    assetInbox?: AssetInboxSendFlow
    assetHolding?: {
        buildOptInTxs(params: AssetOptInTxsParams): Promise<PeraTransaction[]>
        buildOptOutTxs(params: AssetOptOutTxsParams): Promise<PeraTransaction[]>
    }
    rekey?: { buildTx(params: RekeyTxParams): Promise<PeraTransaction> }
    keyRegistration?: {
        buildTx(params: KeyRegistrationTxParams): Promise<PeraTransaction>
    }
}

export const sendFlowChainAdapters =
    createChainAdapterRegistry<SendFlowChainAdapter>('send flow')

type SendFlowFeature =
    | 'express'
    | 'assetInbox'
    | 'assetHolding'
    | 'rekey'
    | 'keyRegistration'

/** Throws {@link PeraServiceUnavailableError} when the chain lacks the feature. */
export const sendFlowFeatureFor = <K extends SendFlowFeature>(
    scope: ChainScope,
    feature: K,
): NonNullable<SendFlowChainAdapter[K]> => {
    const value = sendFlowChainAdapters.get(scope.chainId)[feature]
    if (!value) throw new PeraServiceUnavailableError(scope)

    return value as NonNullable<SendFlowChainAdapter[K]>
}

export const buildKeyRegistrationTx = async (
    params: KeyRegistrationTxParams,
): Promise<PeraTransaction> =>
    sendFlowFeatureFor(params.scope, 'keyRegistration').buildTx(params)
