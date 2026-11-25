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
    hexToBigInt,
    isHex,
    TransactionReceiptNotFoundError,
    type Hex,
    type PublicClient,
} from 'viem'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

export const readReceipt = async (client: PublicClient, hash: Hex) => {
    try {
        return await client.getTransactionReceipt({ hash })
    } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) return null
        throw error
    }
}

type ChargeableReceipt = {
    gasUsed: Nullable<bigint>
    effectiveGasPrice: Nullable<bigint>
    /** OP-stack only. Hex while the client has no OP-stack formatter, which ours doesn't declare. */
    l1Fee?: unknown
}

const l1FeeOf = (value: unknown): bigint => {
    if (typeof value === 'bigint') return value
    if (typeof value === 'string' && isHex(value)) return hexToBigInt(value)
    return 0n
}

/**
 * Wei the mined transaction was charged: gas used at its effective price, plus
 * the L1 data fee an OP-stack chain reports on the receipt; undefined when the
 * node's receipt leaves out a gas field. The operator fee is left out: its
 * receipt formula changes between OP-stack hardforks.
 */
export const chargedFeeOf = ({
    gasUsed,
    effectiveGasPrice,
    l1Fee,
}: ChargeableReceipt): Optional<bigint> =>
    gasUsed === null || effectiveGasPrice === null
        ? undefined
        : gasUsed * effectiveGasPrice + l1FeeOf(l1Fee)
