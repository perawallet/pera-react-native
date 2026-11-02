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
    type Address,
    type FeeValuesEIP1559,
    type TransactionSerializableEIP1559,
    type TransactionSerialized,
} from 'viem'
import type {
    BuildContext,
    ChainContext,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { Database } from '@perawallet/wallet-core-database'
import {
    InvalidSendParamsError,
    type TransactionGapFillRequest,
    type TransactionGapRequest,
    type TransactionReplacementRequest,
} from '@perawallet/wallet-core-transactions'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    getSubmissionAttemptsAtNonce,
    OPEN_SUBMISSION_STATUSES,
} from '@perawallet/wallet-core-signing'
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

const cancelAt = (
    from: Address,
    priced: Omit<TransactionSerializableEIP1559, 'to' | 'value' | 'gas'>,
): TransactionSerializableEIP1559 => ({
    ...priced,
    to: from,
    value: 0n,
    gas: CANCEL_GAS,
})

const readOwnedTransaction = async (
    rawTransaction: string,
    chain: EvmChain,
    context: BuildContext,
): Promise<{ original: EvmPricedTransaction; from: Address }> => {
    const original = readReplaceableTransaction(rawTransaction)
    if (
        !original ||
        original.chainId !== eip155ChainIdOf(context.scope, chain)
    ) {
        throw new InvalidSendParamsError()
    }
    const from = await recoverTransactionAddress({
        serializedTransaction: rawTransaction as TransactionSerialized,
    })
    return { original, from }
}

const readFastFees = async (
    ctx: ChainContext,
    chain: EvmChain,
    context: BuildContext,
): Promise<FeeValuesEIP1559> => {
    const client = createEvmClient(context.scope, ctx, chain)
    const { presets } = await readEvmFeePresets(
        client,
        chain,
        context.scope.networkId,
    ).catch((error: unknown) => {
        throw toEvmError(error, chain.row.nativeAsset.symbol)
    })
    return presets.fast
}

/**
 * The first nonce below the pending transaction's that the node holds
 * nothing at and no send of the wallet holds open or saw mined. The node's pending count
 * runs over contiguous nonces only, so one short of ours names the gap.
 */
export const findEvmNonceGap = async (
    ctx: ChainContext,
    chain: EvmChain,
    request: TransactionGapRequest,
    context: BuildContext,
    db?: Database,
): Promise<Nullable<number>> => {
    const { original, from } = await readOwnedTransaction(
        request.rawTransaction,
        chain,
        context,
    )
    const client = createEvmClient(context.scope, ctx, chain)
    const pending = await client
        .getTransactionCount({ address: from, blockTag: 'pending' })
        .catch((error: unknown) => {
            throw toEvmError(error, chain.row.nativeAsset.symbol)
        })
    if (pending >= original.nonce) return null
    // A load-balanced node can lag the ledger: an open send there is still
    // inside the reconciler's grace, and a confirmed or replaced one mined.
    const attempts = await getSubmissionAttemptsAtNonce({
        db,
        scope: context.scope,
        sender: from,
        nonce: pending,
        statuses: [...OPEN_SUBMISSION_STATUSES, 'confirmed', 'replaced'],
    })
    return attempts.length === 0 ? pending : null
}

/** A cancel at the empty nonce, priced at the fast preset since nothing there needs outbidding. */
export const buildEvmGapFill = async (
    ctx: ChainContext,
    chain: EvmChain,
    request: TransactionGapFillRequest,
    context: BuildContext,
): Promise<UnsignedTransaction[]> => {
    const { original, from } = await readOwnedTransaction(
        request.rawTransaction,
        chain,
        context,
    )
    if (request.sequence >= original.nonce) throw new InvalidSendParamsError()
    const fast = await readFastFees(ctx, chain, context)
    const payload: EthereumTransactionPayload = {
        from,
        transaction: cancelAt(from, {
            type: 'eip1559',
            chainId: original.chainId,
            nonce: request.sequence,
            ...fast,
        }),
    }
    return [
        {
            scope: context.scope,
            payload,
            summary: cancelSummary(from, chain.descriptor.nativeAsset.ref),
            chainData: { family: 'evm' },
        },
    ]
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
    const { original, from } = await readOwnedTransaction(
        request.rawTransaction,
        chain,
        context,
    )
    const fast = await readFastFees(ctx, chain, context)
    const priced = {
        type: 'eip1559',
        chainId: original.chainId,
        nonce: original.nonce,
        ...replacementFees(original, fast),
    } as const
    const isCancel = request.kind === 'cancel'
    const transaction: TransactionSerializableEIP1559 = isCancel
        ? cancelAt(from, priced)
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
