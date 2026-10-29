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
    parseAbi,
    serializeTransaction,
    type FeeValuesEIP1559,
    type PublicClient,
    type TransactionSerializableEIP1559,
} from 'viem'
import { Decimal } from 'decimal.js'
import {
    FEE_PRESETS,
    type FeeEstimate,
    type FeePreset,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmChain } from '../chains/types'
import type { EvmTransferCall } from './builder'

/**
 * Gas is in gas units; every fee is in wei per gas, and `baseFeePerGas` is the
 * next block's. `surcharge` is in wei: what the chain charges on top of gas,
 * priced on the fast preset's transaction and used for every preset.
 */
export type EvmTransferFees = {
    gas: bigint
    baseFeePerGas: bigint
    presets: Record<FeePreset, FeeValuesEIP1559>
    surcharge: bigint
}

const FEE_HISTORY_BLOCK_COUNT = 10

const FEE_PRESET_PERCENTILE: Record<FeePreset, number> = {
    slow: 10,
    normal: 50,
    fast: 90,
}

// A heuristic, not a mempool reading: with the base-fee headroom below, a
// percentile tip from recent blocks usually lands within this many blocks.
const FEE_PRESET_EXPECTED_BLOCKS: Record<FeePreset, number> = {
    slow: 5,
    normal: 3,
    fast: 1,
}

const MS_PER_SECOND = 1000

// Doubling the base fee survives several full blocks of base-fee growth; only base fee plus tip is charged.
const BASE_FEE_HEADROOM = 2n

const compareBigInt = (a: bigint, b: bigint): number => {
    if (a < b) return -1
    if (a > b) return 1
    return 0
}

const upperMedian = (values: bigint[]): bigint =>
    values.length === 0
        ? 0n
        : [...values].sort(compareBigInt)[Math.floor(values.length / 2)]

const minPriorityFeeOf = (chain: EvmChain, networkId: NetworkId): bigint =>
    chain.row.fee.kind === 'eip1559-min-tip'
        ? (chain.row.fee.minPriorityFeePerGas[networkId] ?? 0n)
        : 0n

/**
 * Reads EIP-1559 fees at each preset's fee-history percentile. A tip below the
 * chain's minimum is raised to it: the node would drop the transaction.
 */
export const readEvmFeePresets = async (
    client: PublicClient,
    chain: EvmChain,
    networkId: NetworkId,
): Promise<Omit<EvmTransferFees, 'gas' | 'surcharge'>> => {
    const minPriorityFeePerGas = minPriorityFeeOf(chain, networkId)
    const history = await client.getFeeHistory({
        blockCount: FEE_HISTORY_BLOCK_COUNT,
        rewardPercentiles: FEE_PRESETS.map(
            preset => FEE_PRESET_PERCENTILE[preset],
        ),
    })
    // The last entry is the next block's base fee.
    const baseFeePerGas = history.baseFeePerGas.at(-1)
    if (baseFeePerGas === undefined) {
        throw new Error('The node returned an empty fee history')
    }
    // An empty block reports all-zero rewards and would drag a quiet network's tip to zero. Skipping
    // rows without every preset's column keeps slow <= normal <= fast.
    const rewards = (history.reward ?? []).filter(
        (row, i) =>
            history.gasUsedRatio[i] > 0 && row.length >= FEE_PRESETS.length,
    )
    const presets = Object.fromEntries(
        FEE_PRESETS.map((preset, column) => {
            const percentileTip = upperMedian(rewards.map(row => row[column]))
            const maxPriorityFeePerGas =
                percentileTip < minPriorityFeePerGas
                    ? minPriorityFeePerGas
                    : percentileTip
            return [
                preset,
                {
                    maxPriorityFeePerGas,
                    maxFeePerGas:
                        BASE_FEE_HEADROOM * baseFeePerGas +
                        maxPriorityFeePerGas,
                },
            ]
        }),
    ) as Record<FeePreset, FeeValuesEIP1559>
    return { baseFeePerGas, presets }
}

/** An EIP-1559 transaction with every field that sizes its encoding. Signature fields, if present, are ignored. */
export type EvmPricedTransaction = TransactionSerializableEIP1559 &
    FeeValuesEIP1559 & { chainId: number; nonce: number; gas: bigint }

// viem's estimateL1Fee and estimateOperatorFee serialise with stub nonce, gas
// and fees, which changes the size the oracle prices, so the oracle is read
// directly. Our defineChain declares no contracts either, so viem couldn't find it.
const gasPriceOracleAbi = parseAbi([
    'function getL1Fee(bytes _data) view returns (uint256)',
    'function getOperatorFee(uint256 _gasUsed) view returns (uint256)',
])

// The oracle adds a signature's size itself; a signature in the bytes would be counted twice.
const unsignedEncodingOf = ({
    r: _r,
    s: _s,
    v: _v,
    yParity: _yParity,
    ...unsigned
}: EvmPricedTransaction) =>
    serializeTransaction({
        ...unsigned,
        type: 'eip1559',
    } as TransactionSerializableEIP1559)

/**
 * Wei the chain charges on top of gas for `transaction`: on an OP-stack chain,
 * the oracle's L1 data fee for its unsigned encoding plus its operator fee;
 * elsewhere `0n` with no read. Rejects when a read fails.
 */
export const readEvmSurcharge = async (
    client: PublicClient,
    chain: EvmChain,
    transaction: EvmPricedTransaction,
): Promise<bigint> => {
    const { fee } = chain.row
    if (fee.kind !== 'eip1559-op-stack') return 0n
    const address = fee.gasPriceOracleAddress
    const [l1DataFee, operatorFee] = await Promise.all([
        client.readContract({
            address,
            abi: gasPriceOracleAbi,
            functionName: 'getL1Fee',
            args: [unsignedEncodingOf(transaction)],
        }),
        client.readContract({
            address,
            abi: gasPriceOracleAbi,
            functionName: 'getOperatorFee',
            args: [transaction.gas],
        }),
    ])
    return l1DataFee + operatorFee
}

/** Estimates the call's gas and reads EIP-1559 fees at each preset's fee-history percentile. */
export const readTransferGasAndPresets = async (
    client: PublicClient,
    call: EvmTransferCall,
    chain: EvmChain,
    networkId: NetworkId,
): Promise<Omit<EvmTransferFees, 'surcharge'>> => {
    const [gas, fees] = await Promise.all([
        client.estimateGas({
            account: call.from,
            to: call.to,
            value: call.value,
            data: call.data,
        }),
        readEvmFeePresets(client, chain, networkId),
    ])
    return { gas, ...fees }
}

/** Estimates the call's gas and surcharge, and reads EIP-1559 fees at each preset's fee-history percentile. */
export const readTransferFees = async (
    client: PublicClient,
    call: EvmTransferCall,
    chain: EvmChain,
    networkId: NetworkId,
): Promise<EvmTransferFees> => {
    if (chain.row.fee.kind !== 'eip1559-op-stack') {
        return {
            ...(await readTransferGasAndPresets(
                client,
                call,
                chain,
                networkId,
            )),
            surcharge: 0n,
        }
    }
    const [fees, nonce] = await Promise.all([
        readTransferGasAndPresets(client, call, chain, networkId),
        // The node's pending count can trail the ledger-aware nonce the build
        // allocates; that rarely changes the encoded length, and a fee read must not depend on the ledger.
        client.getTransactionCount({
            address: call.from,
            blockTag: 'pending',
        }),
    ])
    // The fast preset's caps encode longest; one surcharge prices all three presets.
    const surcharge = await readEvmSurcharge(client, chain, {
        type: 'eip1559',
        chainId: call.chainId,
        nonce,
        to: call.to,
        value: call.value,
        data: call.data,
        gas: fees.gas,
        ...fees.presets.fast,
    })
    return { ...fees, surcharge }
}

/** Prices each preset at gas x (base fee + tip), capped at gas x maxFeePerGas, plus the surcharge, in wei. */
export const toEvmFeeEstimate = (
    fees: EvmTransferFees,
    preset: FeePreset,
    chain: EvmChain,
): FeeEstimate => {
    const presets = Object.fromEntries(
        FEE_PRESETS.map(name => {
            const { maxFeePerGas, maxPriorityFeePerGas } = fees.presets[name]
            return [
                name,
                {
                    amount: new Decimal(
                        (
                            fees.gas *
                                (fees.baseFeePerGas + maxPriorityFeePerGas) +
                            fees.surcharge
                        ).toString(),
                    ),
                    maxAmount: new Decimal(
                        (fees.gas * maxFeePerGas + fees.surcharge).toString(),
                    ),
                    estimatedWaitSeconds: Math.max(
                        1,
                        Math.ceil(
                            (FEE_PRESET_EXPECTED_BLOCKS[name] *
                                chain.row.blockTimeMs) /
                                MS_PER_SECOND,
                        ),
                    ),
                },
            ]
        }),
    ) as NonNullable<FeeEstimate['presets']>
    return {
        assetRef: chain.descriptor.nativeAsset.ref,
        amount: presets[preset].amount,
        presets,
    }
}
