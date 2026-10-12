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

import type { PublicClient } from 'viem'
import type { EthereumTransferCall } from './builder'

/** Gas is in gas units; every fee is in wei per gas. */
export type EthereumTransferFees = {
    gas: bigint
    baseFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    maxFeePerGas: bigint
}

/** Estimates the call's gas and reads EIP-1559 fees at the 50th-percentile tip. */
export const readTransferFees = async (
    client: PublicClient,
    call: EthereumTransferCall,
): Promise<EthereumTransferFees> => {
    const [gas, history] = await Promise.all([
        client.estimateGas({
            account: call.from,
            to: call.to,
            value: call.value,
            data: call.data,
        }),
        client.getFeeHistory({ blockCount: 1, rewardPercentiles: [50] }),
    ])
    // The last entry is the next block's base fee.
    const baseFeePerGas = history.baseFeePerGas.at(-1)
    if (baseFeePerGas === undefined) {
        throw new Error('The node returned an empty fee history')
    }
    const maxPriorityFeePerGas = history.reward?.[0]?.[0] ?? 0n
    return {
        gas,
        baseFeePerGas,
        maxPriorityFeePerGas,
        // Doubling the base fee survives several full blocks of base-fee growth; only base fee plus tip is charged.
        maxFeePerGas: 2n * baseFeePerGas + maxPriorityFeePerGas,
    }
}
