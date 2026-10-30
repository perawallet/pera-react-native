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
    getAddress,
    parseTransaction,
    recoverTransactionAddress,
    type FeeValuesEIP1559,
    type TransactionSerializableEIP1559,
    type TransactionSerialized,
} from 'viem'
import type {
    BuildContext,
    ChainContext,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    InvalidSendParamsError,
    type TransactionReplacementRequest,
} from '@perawallet/wallet-core-transactions'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { toEvmError } from '../blockchain/errors'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import type { EthereumTransactionPayload } from '../signing/adapter'
import { ethereumCallSummary } from '../signing/review'
import { readEvmFeePresets, type EvmPricedTransaction } from './fees'
import { cancelSummary } from './summary'

/** Gas units of a plain transfer, all a cancel needs. */
export const CANCEL_GAS = 21_000n

/**
 * Wei per gas, rounded up. Nodes keep a pending transaction unless a
 * replacement raises both fee fields by 10% (geth's default
 * `txpool.pricebump`), and refuse it as "replacement transaction
 * underpriced" otherwise.
 */
export const bumpReplacementFee = (fee: bigint): bigint =>
    (fee * 11n + 9n) / 10n

const maxOf = (a: bigint, b: bigint): bigint => (a > b ? a : b)

/** Each field at the fast preset or the bumped original, whichever is higher. */
export const replacementFees = (
    original: FeeValuesEIP1559,
    fast: FeeValuesEIP1559,
): FeeValuesEIP1559 => ({
    maxFeePerGas: maxOf(
        fast.maxFeePerGas,
        bumpReplacementFee(original.maxFeePerGas),
    ),
    maxPriorityFeePerGas: maxOf(
        fast.maxPriorityFeePerGas,
        bumpReplacementFee(original.maxPriorityFeePerGas),
    ),
})

export const meetsReplacementBump = (
    original: FeeValuesEIP1559,
    replacement: FeeValuesEIP1559,
): boolean =>
    replacement.maxFeePerGas >= bumpReplacementFee(original.maxFeePerGas) &&
    replacement.maxPriorityFeePerGas >=
        bumpReplacementFee(original.maxPriorityFeePerGas)

/** The signed EIP-1559 transaction an attempt broadcast; null for anything else. */
export const readReplaceableTransaction = (
    rawTransaction: string,
): Nullable<EvmPricedTransaction> => {
    let parsed: ReturnType<typeof parseTransaction>
    try {
        parsed = parseTransaction(rawTransaction as TransactionSerialized)
    } catch {
        return null
    }
    const { type, chainId, nonce, gas, maxFeePerGas, maxPriorityFeePerGas } =
        parsed
    if (
        type !== 'eip1559' ||
        chainId === undefined ||
        nonce === undefined ||
        gas === undefined ||
        maxFeePerGas === undefined ||
        maxPriorityFeePerGas === undefined
    ) {
        return null
    }
    return parsed as EvmPricedTransaction
}

/**
 * A speed-up resends the same call; a cancel sends nothing to the sender
 * itself. Both keep the pending transaction's nonce, so neither touches the
 * nonce pool.
 */
export const buildEvmReplacement = async (
    ctx: ChainContext,
    chain: EvmChain,
    request: TransactionReplacementRequest,
    context: BuildContext,
): Promise<UnsignedTransaction[]> => {
    const original = readReplaceableTransaction(request.rawTransaction)
    if (
        !original ||
        original.chainId !== eip155ChainIdOf(context.scope, chain)
    ) {
        throw new InvalidSendParamsError()
    }
    const from = await recoverTransactionAddress({
        serializedTransaction: request.rawTransaction as TransactionSerialized,
    })
    const client = createEvmClient(context.scope, ctx, chain)
    const { presets } = await readEvmFeePresets(
        client,
        chain,
        context.scope.networkId,
    ).catch((error: unknown) => {
        throw toEvmError(error, chain.row.nativeAsset.symbol)
    })
    const priced = {
        type: 'eip1559',
        chainId: original.chainId,
        nonce: original.nonce,
        ...replacementFees(original, presets.fast),
    } as const
    const isCancel = request.kind === 'cancel'
    const transaction: TransactionSerializableEIP1559 = isCancel
        ? { ...priced, to: from, value: 0n, gas: CANCEL_GAS }
        : {
              ...priced,
              to: original.to ? getAddress(original.to) : original.to,
              value: original.value,
              data: original.data,
              gas: original.gas,
              accessList: original.accessList,
          }
    const payload: EthereumTransactionPayload = { from, transaction }
    const summary = isCancel
        ? cancelSummary(from, chain.descriptor.nativeAsset.ref)
        : (request.summary ??
          ethereumCallSummary(
              {
                  from,
                  to: original.to ? getAddress(original.to) : undefined,
                  value: original.value ?? 0n,
                  data: original.data ?? '0x',
              },
              chain,
          ))
    return [
        {
            scope: context.scope,
            payload,
            summary,
            chainData: { family: 'evm' },
        },
    ]
}
