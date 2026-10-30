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
    encodeFunctionData,
    erc20Abi,
    getAddress,
    isAddress,
    maxUint256,
    type Address,
    type Hex,
} from 'viem'
import { Decimal } from 'decimal.js'
import {
    isNativeAsset,
    type BuildContext,
    type ChainContext,
    type FeeEstimate,
    type TransactionIntent,
    type TransactionSummary,
    type TransferIntent,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { toBigInt } from '@perawallet/wallet-core-shared'
import {
    InvalidSendParamsError,
    UnsupportedTransactionIntentError,
    type TransferChainAdapter,
} from '@perawallet/wallet-core-transactions'
import { toEvmError } from '../blockchain/errors'
import { eip155ChainIdOf, isEvmNftAssetId } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import type { EthereumTransactionPayload } from '../signing/adapter'
import {
    readTransferFees,
    readTransferGasAndPresets,
    toEvmFeeEstimate,
} from './fees'
import { allocateEthereumNonce } from './nonce-pool'
import { encodeEvmNftTransfer, readEvmNftTransferAsset } from './nft-transfer'
import { buildEvmReplacement } from './replacement'
import { createEvmSpendableBalance } from './spendable-balance'
import { nftSendSubtitle, sendSummary } from './summary'

const MAX_UINT256 = new Decimal(maxUint256.toString())

/**
 * The EVM call a transfer intent becomes. `value` is in wei; for an ERC-20 or
 * NFT transfer `to` is the token's contract.
 */
export type EvmTransferCall = {
    chainId: number
    from: Address
    to: Address
    value: bigint
    data?: Hex
}

type EvmTransfer = { call: EvmTransferCall; summary: TransactionSummary }

const ONE = new Decimal(1)

// An ERC-1155 amount of 0 only prices: the amount step estimates the fee before
// the user types one, and `buildEvmTransfer` refuses to build it.
const toNftTransfer = async (
    chainId: number,
    intent: TransferIntent,
    context: BuildContext,
): Promise<EvmTransfer> => {
    const nft = await readEvmNftTransferAsset(
        context.scope,
        intent.assetRef.assetId,
    )
    if (!nft || (nft.standard === 'erc721' && !intent.amount.equals(ONE))) {
        throw new InvalidSendParamsError()
    }
    const from = getAddress(intent.from)
    const to = getAddress(intent.to)
    return {
        call: {
            chainId,
            from,
            to: nft.contract,
            value: 0n,
            data: encodeEvmNftTransfer({
                standard: nft.standard,
                from,
                to,
                tokenId: nft.tokenId,
                amount: toBigInt(intent.amount),
            }),
        },
        summary: sendSummary(
            'nft-transfer',
            intent.from,
            intent.to,
            { assetRef: intent.assetRef, value: intent.amount },
            nftSendSubtitle(nft.collectionName ?? nft.contract, nft.tokenId),
        ),
    }
}

// An intent's note is dropped: EVM has no memo, and calldata on a token
// transfer would change the call.
const toEvmTransfer = async (
    chain: EvmChain,
    intent: TransactionIntent,
    context: BuildContext,
): Promise<EvmTransfer> => {
    const chainId = eip155ChainIdOf(context.scope, chain)
    if (intent.kind !== 'transfer') {
        throw new UnsupportedTransactionIntentError(intent.kind, chain.row.id)
    }
    const isNative = isNativeAsset(intent.assetRef, chain.descriptor)
    const isNft = !isNative && isEvmNftAssetId(intent.assetRef.assetId)
    if (
        intent.assetRef.chainId !== chain.row.id ||
        (!isNative && !isNft && !isAddress(intent.assetRef.assetId)) ||
        !isAddress(intent.from) ||
        !isAddress(intent.to) ||
        !intent.amount.isInteger() ||
        intent.amount.isNegative() ||
        intent.amount.gt(MAX_UINT256)
    ) {
        throw new InvalidSendParamsError()
    }
    if (isNft) return toNftTransfer(chainId, intent, context)
    const from = getAddress(intent.from)
    const to = getAddress(intent.to)
    const amount = toBigInt(intent.amount)
    const summary = sendSummary(
        isNative ? 'transfer' : 'token-transfer',
        intent.from,
        intent.to,
        { assetRef: intent.assetRef, value: intent.amount },
    )
    if (isNative) {
        return { call: { chainId, from, to, value: amount }, summary }
    }
    return {
        call: {
            chainId,
            from,
            to: getAddress(intent.assetRef.assetId),
            value: 0n,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [to, amount],
            }),
        },
        summary,
    }
}

const buildEvmTransfer = async (
    ctx: ChainContext,
    chain: EvmChain,
    intent: TransactionIntent,
    context: BuildContext,
): Promise<UnsignedTransaction[]> => {
    // Review honours no NFT transfer of nothing, so build none.
    if (
        intent.kind === 'transfer' &&
        isEvmNftAssetId(intent.assetRef.assetId) &&
        intent.amount.isZero()
    ) {
        throw new InvalidSendParamsError()
    }
    const { call, summary } = await toEvmTransfer(chain, intent, context)
    const client = createEvmClient(context.scope, ctx, chain)
    // The node's pending count and the ledger's open sends, not
    // context.chainState: a synced snapshot can lag the mempool.
    const [nonce, fees] = await Promise.all([
        allocateEthereumNonce({
            client,
            scope: context.scope,
            sender: call.from,
        }),
        readTransferGasAndPresets(client, call, chain, context.scope.networkId),
    ]).catch((error: unknown) => {
        throw toEvmError(error, chain.row.nativeAsset.symbol)
    })
    const prices = fees.presets[context.feePreset ?? 'normal']
    const payload: EthereumTransactionPayload = {
        from: call.from,
        transaction: {
            type: 'eip1559',
            chainId: call.chainId,
            nonce,
            to: call.to,
            value: call.value,
            data: call.data,
            gas: fees.gas,
            maxFeePerGas: prices.maxFeePerGas,
            maxPriorityFeePerGas: prices.maxPriorityFeePerGas,
        },
    }
    return [
        {
            scope: context.scope,
            payload,
            summary,
            chainData: { family: 'evm' },
        },
    ]
}

const estimateEvmTransferFee = async (
    ctx: ChainContext,
    chain: EvmChain,
    intent: TransactionIntent,
    context: BuildContext,
): Promise<FeeEstimate> => {
    const { call } = await toEvmTransfer(chain, intent, context)
    const client = createEvmClient(context.scope, ctx, chain)
    const fees = await readTransferFees(
        client,
        call,
        chain,
        context.scope.networkId,
    ).catch((error: unknown) => {
        throw toEvmError(error, chain.row.nativeAsset.symbol)
    })
    return toEvmFeeEstimate(fees, context.feePreset ?? 'normal', chain)
}

export const createEvmTransferAdapter = (
    ctx: ChainContext,
    chain: EvmChain,
): TransferChainAdapter => ({
    chainId: chain.row.id,
    build: (intent, context) => buildEvmTransfer(ctx, chain, intent, context),
    getFeeEstimate: (intent, context) =>
        estimateEvmTransferFee(ctx, chain, intent, context),
    spendableBalance: createEvmSpendableBalance(chain),
    buildReplacement: (request, context) =>
        buildEvmReplacement(ctx, chain, request, context),
})
