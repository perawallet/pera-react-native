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
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import type { EthereumTransactionPayload } from '../signing/adapter'
import { readTransferFees, toEthereumFeeEstimate } from './fees'
import { allocateEthereumNonce } from './nonce-pool'
import { readEthereumSpendableBalance } from './spendable-balance'
import { sendSummary } from './summary'

const MAX_UINT256 = new Decimal(maxUint256.toString())

/** The EVM call a transfer intent becomes. `value` is in wei; for an ERC-20 transfer `to` is the token contract. */
export type EthereumTransferCall = {
    chainId: number
    from: Address
    to: Address
    value: bigint
    data?: Hex
}

// An intent's note is dropped: EVM has no memo, and calldata on a token
// transfer would change the call.
const toEthereumTransferCall = (
    intent: TransactionIntent,
    context: BuildContext,
): EthereumTransferCall => {
    const chainId = eip155ChainIdOf(context.scope)
    if (intent.kind !== 'transfer') {
        throw new UnsupportedTransactionIntentError(
            intent.kind,
            ETHEREUM_CHAIN_ID,
        )
    }
    const isNative = isNativeAsset(intent.assetRef, ethereumDescriptor)
    if (
        intent.assetRef.chainId !== ETHEREUM_CHAIN_ID ||
        (!isNative && !isAddress(intent.assetRef.assetId)) ||
        !isAddress(intent.from) ||
        !isAddress(intent.to) ||
        !intent.amount.isInteger() ||
        intent.amount.isNegative() ||
        intent.amount.gt(MAX_UINT256)
    ) {
        throw new InvalidSendParamsError()
    }
    const from = getAddress(intent.from)
    const to = getAddress(intent.to)
    const amount = toBigInt(intent.amount)
    if (isNative) return { chainId, from, to, value: amount }
    return {
        chainId,
        from,
        to: getAddress(intent.assetRef.assetId),
        value: 0n,
        data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [to, amount],
        }),
    }
}

const transferSummary = (
    intent: TransferIntent,
    isNative: boolean,
): TransactionSummary =>
    sendSummary(
        isNative ? 'transfer' : 'token-transfer',
        intent.from,
        intent.to,
        {
            assetRef: intent.assetRef,
            value: intent.amount,
        },
    )

const buildEthereumTransfer = async (
    ctx: ChainContext,
    intent: TransactionIntent,
    context: BuildContext,
): Promise<UnsignedTransaction[]> => {
    const call = toEthereumTransferCall(intent, context)
    const client = createEvmClient(context.scope, ctx)
    // The node's pending count and the ledger's open sends, not
    // context.chainState: a synced snapshot can lag the mempool.
    const [nonce, fees] = await Promise.all([
        allocateEthereumNonce({
            client,
            scope: context.scope,
            sender: call.from,
        }),
        readTransferFees(client, call),
    ]).catch((error: unknown) => {
        throw toEvmError(error)
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
            // toEthereumTransferCall only returns for a transfer intent.
            summary: transferSummary(
                intent as TransferIntent,
                call.data === undefined,
            ),
            chainData: { family: 'evm' },
        },
    ]
}

const estimateEthereumTransferFee = async (
    ctx: ChainContext,
    intent: TransactionIntent,
    context: BuildContext,
): Promise<FeeEstimate> => {
    const call = toEthereumTransferCall(intent, context)
    const client = createEvmClient(context.scope, ctx)
    const fees = await readTransferFees(client, call).catch(
        (error: unknown) => {
            throw toEvmError(error)
        },
    )
    return toEthereumFeeEstimate(fees, context.feePreset ?? 'normal')
}

export const createEthereumTransferAdapter = (
    ctx: ChainContext,
): TransferChainAdapter => ({
    chainId: ETHEREUM_CHAIN_ID,
    build: (intent, context) => buildEthereumTransfer(ctx, intent, context),
    getFeeEstimate: (intent, context) =>
        estimateEthereumTransferFee(ctx, intent, context),
    spendableBalance: readEthereumSpendableBalance,
})
