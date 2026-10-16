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

import type { FeeValuesEIP1559, PublicClient } from 'viem'
import { Decimal } from 'decimal.js'
import {
    FEE_PRESETS,
    type FeeEstimate,
    type FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumDescriptor } from '../descriptor'
import type { EthereumTransferCall } from './builder'

/** Gas is in gas units; every fee is in wei per gas, and `baseFeePerGas` is the next block's. */
export type EthereumTransferFees = {
    gas: bigint
    baseFeePerGas: bigint
    presets: Record<FeePreset, FeeValuesEIP1559>
}

const FEE_HISTORY_BLOCK_COUNT = 10

const FEE_PRESET_PERCENTILE: Record<FeePreset, number> = {
    slow: 10,
    normal: 50,
    fast: 90,
}

// Doubling the base fee survives several full blocks of base-fee growth; only base fee plus tip is charged.
const BASE_FEE_HEADROOM = 2n

const upperMedian = (values: bigint[]): bigint =>
    values.length === 0
        ? 0n
        : [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[
              Math.floor(values.length / 2)
          ]

/** Reads EIP-1559 fees at each preset's fee-history percentile. */
export const readEthereumFeePresets = async (
    client: PublicClient,
): Promise<Omit<EthereumTransferFees, 'gas'>> => {
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
            const maxPriorityFeePerGas = upperMedian(
                rewards.map(row => row[column]),
            )
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

/** Estimates the call's gas and reads EIP-1559 fees at each preset's fee-history percentile. */
export const readTransferFees = async (
    client: PublicClient,
    call: EthereumTransferCall,
): Promise<EthereumTransferFees> => {
    const [gas, fees] = await Promise.all([
        client.estimateGas({
            account: call.from,
            to: call.to,
            value: call.value,
            data: call.data,
        }),
        readEthereumFeePresets(client),
    ])
    return { gas, ...fees }
}

/** Prices each preset at gas x (base fee + tip), capped at gas x maxFeePerGas, in wei. */
export const toEthereumFeeEstimate = (
    fees: EthereumTransferFees,
    preset: FeePreset,
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
                            (fees.baseFeePerGas + maxPriorityFeePerGas)
                        ).toString(),
                    ),
                    maxAmount: new Decimal(
                        (fees.gas * maxFeePerGas).toString(),
                    ),
                },
            ]
        }),
    ) as NonNullable<FeeEstimate['presets']>
    return {
        assetRef: ethereumDescriptor.nativeAsset.ref,
        amount: presets[preset].amount,
        presets,
    }
}
