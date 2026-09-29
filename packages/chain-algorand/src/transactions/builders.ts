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
import {
    createWalletAlgorandClient,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { isAlgoAssetId } from '@perawallet/wallet-core-shared'
import type {
    AssetOptInTxsParams,
    AssetOptOutTxsParams,
    ExpressTransferTxsParams,
    KeyRegistrationTxParams,
    RekeyTxParams,
    TransferTxsParams,
} from '@perawallet/wallet-core-transactions'
import { algorandNetworkOf } from '../legacy-network'

// Built per call so a custom-network edit is picked up, as useAlgorandClient's
// memo does.
const clientFor = (scope: ChainScope) =>
    createWalletAlgorandClient(algorandNetworkOf(scope))

type Composer = ReturnType<ReturnType<typeof clientFor>['newGroup']>

const buildGroup = async (composer: Composer): Promise<PeraTransaction[]> => {
    const { transactions } = await composer.build()
    return transactions.map(t => t.txn)
}

// staticFee only overrides AlgoKit's auto-sizing when the caller passes one.
const feeOverride = (fee: bigint | undefined) =>
    fee === undefined ? {} : { staticFee: microAlgo(fee) }

export const buildTransferTxs = ({
    scope,
    sender,
    receiver,
    assetId,
    amount,
    note,
    isCloseAccount,
    fee,
}: TransferTxsParams): Promise<PeraTransaction[]> => {
    const composer = clientFor(scope).newGroup()
    if (isAlgoAssetId(assetId)) {
        composer.addPayment({
            sender,
            receiver,
            amount: microAlgo(isCloseAccount ? 0n : amount),
            ...(isCloseAccount && { closeRemainderTo: receiver }),
            note,
            ...feeOverride(fee),
        })
    } else {
        composer.addAssetTransfer({
            sender,
            receiver,
            amount,
            assetId: BigInt(assetId),
            note,
            ...feeOverride(fee),
        })
    }
    return buildGroup(composer)
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
    const composer = clientFor(scope).newGroup()

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

    return buildGroup(composer)
}

export const buildOptInTxs = ({
    scope,
    sender,
    assetId,
}: AssetOptInTxsParams): Promise<PeraTransaction[]> =>
    buildGroup(clientFor(scope).newGroup().addAssetOptIn({ sender, assetId }))

export const buildOptOutTxs = ({
    scope,
    optOuts,
}: AssetOptOutTxsParams): Promise<PeraTransaction[]> => {
    const composer = clientFor(scope).newGroup()
    for (const { sender, assetId, creator } of optOuts) {
        composer.addAssetTransfer({
            sender,
            receiver: sender,
            assetId,
            amount: 0n,
            closeAssetTo: creator,
        })
    }
    return buildGroup(composer)
}

export const buildRekeyTx = async ({
    scope,
    sourceAddress,
    rekeyToAddress,
    minFee,
}: RekeyTxParams): Promise<PeraTransaction> => {
    const { createTransaction } = clientFor(scope)
    const payment = {
        sender: sourceAddress,
        receiver: sourceAddress,
        amount: microAlgo(0n),
        rekeyTo: rekeyToAddress,
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

export const buildKeyRegistrationTx = (
    params: KeyRegistrationTxParams,
): Promise<PeraTransaction> => {
    const { createTransaction } = clientFor(params.scope)
    const common = {
        sender: params.sender,
        note: params.note,
        staticFee: params.fee === undefined ? undefined : microAlgo(params.fee),
    }
    return params.kind === 'offline'
        ? createTransaction.offlineKeyRegistration(common)
        : createTransaction.onlineKeyRegistration({
              ...common,
              voteKey: params.voteKey,
              selectionKey: params.selectionKey,
              stateProofKey: params.stateProofKey,
              voteFirst: params.voteFirst,
              voteLast: params.voteLast,
              voteKeyDilution: params.voteKeyDilution,
          })
}
