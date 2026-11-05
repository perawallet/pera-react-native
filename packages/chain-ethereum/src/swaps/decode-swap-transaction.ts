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

import { getAddress, isHex, parseTransaction } from 'viem'
import type { Address, Hex, TransactionSerialized } from 'viem'
import { SwapQuoteMismatchError } from '@perawallet/wallet-core-swaps'

/** `value` in wei. Only what the wallet keeps: nonce, gas and fees are its own. */
export type EvmSwapCall = {
    chainId: number
    to: Address
    value: bigint
    data: Hex
}

const parse = (encoded: string): ReturnType<typeof parseTransaction> => {
    if (!isHex(encoded)) {
        throw new SwapQuoteMismatchError('The swap transaction is not hex')
    }
    try {
        return parseTransaction(encoded as TransactionSerialized)
    } catch {
        throw new SwapQuoteMismatchError('The swap transaction is unreadable')
    }
}

export const decodeSwapTransaction = (encoded: string): EvmSwapCall => {
    const { type, to, chainId, value, data } = parse(encoded)
    // A delegation or a blob does more than the call it carries.
    if (type === 'eip7702' || type === 'eip4844') {
        throw new SwapQuoteMismatchError(
            `The swap transaction is of type ${type}`,
        )
    }
    if (!to || chainId === undefined) {
        throw new SwapQuoteMismatchError(
            'The swap transaction names no target or no chain',
        )
    }
    return {
        chainId,
        to: getAddress(to),
        value: value ?? 0n,
        data: data ?? '0x',
    }
}
