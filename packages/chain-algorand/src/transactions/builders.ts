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

import { microAlgo } from '@algorandfoundation/algokit-utils'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    createWalletAlgorandClient,
    decodeTransaction,
    encodeTransaction,
    groupTransactions,
} from '../blockchain'

import {
    FeeAboveShownError,
    type AssetOptInTxsParams,
    type AssetOptOutTxsParams,
    type ExpressTransferTxsParams,
    type KeyRegistrationTxParams,
    type DelegationTxParams,
    type TransferTxsParams,
} from '@perawallet/wallet-core-transactions'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isAlgorandNativeAssetId } from '../descriptor'
import { algorandNetworkOf } from '../network-id'
import type { PeraTransaction } from '../blockchain/models/algosdk-shapes'

// Built per call so a custom-network edit is picked up, as useAlgorandClient's
// memo does.
const clientFor = (scope: ChainScope) =>
    createWalletAlgorandClient(algorandNetworkOf(scope))

type Client = ReturnType<typeof clientFor>
type Composer = ReturnType<Client['newGroup']>

/**
 * AlgoKit auto-sizes fees from the node's per-byte price. Callers that
 * accept a higher fee must arrange review of the assembled transaction group.
 * Other callers retain a per-transaction minimum-fee cap.
 */
const buildGroup = async (
    client: Client,
    composer: Composer,
    explicitFees: Array<Optional<bigint>>,
    allowFeeReview: Optional<boolean>,
): Promise<PeraTransaction[]> => {
    const { transactions } = await composer.build()
    const txns = transactions.map(t => t.txn)
    if (allowFeeReview) return txns

    const minFee = BigInt((await client.getSuggestedParams()).minFee)
    for (const [index, txn] of txns.entries()) {
        const fee = txn.fee ?? 0n
        const explicitFee = explicitFees[index] ?? 0n
        const limit = explicitFee > minFee ? explicitFee : minFee
        if (fee > limit) throw new FeeAboveShownError(fee, limit)
    }
    return txns
}

// staticFee only overrides AlgoKit's auto-sizing when the caller passes one.
const feeOverride = (fee: Optional<bigint>) =>
    fee === undefined ? {} : { staticFee: microAlgo(fee) }

export const buildTransferTxs = async ({
    scope,
    sender,
    receiver,
    assetId,
    amount,
    note,
    isCloseAccount,
    fee,
    allowFeeReview,
}: TransferTxsParams): Promise<PeraTransaction[]> => {
    const client = clientFor(scope)
    const composer = client.newGroup()
    if (isAlgorandNativeAssetId(assetId)) {
        composer.addPayment({
            sender,
            receiver,
            amount: microAlgo(isCloseAccount ? 0n : amount),
            ...(isCloseAccount && { closeRemainderTo: receiver }),
            note,
            ...feeOverride(allowFeeReview ? undefined : fee),
        })
    } else {
        composer.addAssetTransfer({
            sender,
            receiver,
            amount,
            assetId: BigInt(assetId),
            note,
            ...feeOverride(allowFeeReview ? undefined : fee),
        })
    }
    const txns = await buildGroup(client, composer, [fee], allowFeeReview)
    if (allowFeeReview && fee !== undefined && fee > txns[0].fee) {
        const txn = txns[0]
        txn.fee = fee
        if (txn.group) {
            txn.group = undefined
            groupTransactions(txns)
        }
    }
    return txns
}

export const buildExpressTransferTxs = ({
    scope,
    sender,
    receiver,
    assetId,
    amount,
    funding,
    senderFee,
    receiverFee,
}: ExpressTransferTxsParams): Promise<PeraTransaction[]> => {
    const client = clientFor(scope)
    const composer = client.newGroup()

    if (funding > 0n) {
        composer.addPayment({
            sender,
            receiver,
            amount: microAlgo(funding),
            ...feeOverride(senderFee),
        })
    }

    composer
        .addAssetOptIn({
            sender: receiver,
            assetId,
            ...feeOverride(receiverFee),
        })
        .addAssetTransfer({
            sender,
            receiver,
            amount,
            assetId,
            ...feeOverride(senderFee),
        })

    const fees =
        funding > 0n
            ? [senderFee, receiverFee, senderFee]
            : [receiverFee, senderFee]
    return buildGroup(client, composer, fees, false)
}

export const buildOptInTxs = ({
    scope,
    sender,
    assetId,
    allowFeeReview,
}: AssetOptInTxsParams): Promise<PeraTransaction[]> => {
    const client = clientFor(scope)
    return buildGroup(
        client,
        client.newGroup().addAssetOptIn({ sender, assetId }),
        [],
        allowFeeReview,
    )
}

export const buildOptOutTxs = ({
    scope,
    optOuts,
    allowFeeReview,
}: AssetOptOutTxsParams): Promise<PeraTransaction[]> => {
    const client = clientFor(scope)
    const composer = client.newGroup()
    for (const { sender, assetId, creator } of optOuts) {
        composer.addAssetTransfer({
            sender,
            receiver: sender,
            assetId,
            amount: 0n,
            closeAssetTo: creator,
        })
    }
    return buildGroup(client, composer, [], allowFeeReview)
}

export const buildRekeyTx = async ({
    scope,
    sourceAddress,
    authorityAddress,
    minFee,
}: DelegationTxParams): Promise<PeraTransaction> => {
    const { createTransaction } = clientFor(scope)
    const payment = {
        sender: sourceAddress,
        receiver: sourceAddress,
        amount: microAlgo(0n),
        rekeyTo: authorityAddress,
    }
    const draft = await createTransaction.payment(payment)
    // Rebuild with an explicit fee only when the PQ-aware minimum exceeds what
    // AlgoKit auto-sized from the encoded size: an override below it could
    // underpay under per-byte congestion pricing.
    return minFee > (draft.fee ?? 0n)
        ? createTransaction.payment({
              ...payment,
              staticFee: microAlgo(minFee),
          })
        : draft
}

// Encode-then-decode to normalize: algokit returns a sender as an `Address`
// instance, but the signing pipeline is built around `decodeTransaction(bytes)`'s
// shape (plain string sender, Uint8Array byte fields) and otherwise crashes with
// `Buffer.from(...) received type object`.
const normalized = async (
    built: Promise<PeraTransaction>,
): Promise<PeraTransaction> =>
    decodeTransaction(encodeTransaction(await built)) as PeraTransaction

export const buildKeyRegistrationTx = (
    params: KeyRegistrationTxParams,
): Promise<PeraTransaction> => {
    const { createTransaction } = clientFor(params.scope)
    const common = {
        sender: params.sender,
        note: params.note,
        staticFee: params.fee === undefined ? undefined : microAlgo(params.fee),
    }
    return normalized(
        params.kind === 'offline'
            ? createTransaction.offlineKeyRegistration(common)
            : createTransaction.onlineKeyRegistration({
                  ...common,
                  voteKey: params.voteKey,
                  selectionKey: params.selectionKey,
                  stateProofKey: params.stateProofKey,
                  voteFirst: params.voteFirst,
                  voteLast: params.voteLast,
                  voteKeyDilution: params.voteKeyDilution,
              }),
    )
}
