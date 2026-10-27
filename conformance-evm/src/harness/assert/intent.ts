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

import type { Address, Hex } from 'viem'
import { formatFieldDiff } from '@perawallet/conformance/harness/assert/diff'

/**
 * What a suite says an EVM transaction is. Every field is asserted, and
 * omission is destructive: no `value` asserts 0 wei, no `data` asserts empty
 * calldata. The type is always EIP-1559 and the access list always empty,
 * because the app builds nothing else. Amounts are wei, `gas` is gas units.
 */
export type EvmTxnIntent = {
    chainId: number
    from: Address
    nonce: number
    /** `null` for a contract creation. */
    to: Address | null
    value?: bigint
    data?: Hex
    gas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
}

/**
 * The fields read off a decoded transaction, from whichever side: viem's
 * `parseTransaction` (calldata as `data`, a zero `value` absent) or the node's
 * `eth_getTransactionByHash` (calldata as `input`). Values are `unknown` so a
 * `number` where a `bigint` belongs reaches the diff instead of the compiler.
 */
export type ComparableEvmTransaction = {
    type?: unknown
    chainId?: unknown
    from?: unknown
    nonce?: unknown
    to?: unknown
    value?: unknown
    data?: unknown
    input?: unknown
    gas?: unknown
    maxFeePerGas?: unknown
    maxPriorityFeePerGas?: unknown
    accessList?: unknown
}

export type EvmIntentComparison = {
    ok: boolean
    expected: Record<string, unknown>
    actual: Record<string, unknown>
}

// Raw bytes carry no checksum and the node answers in lowercase.
const lowercase = (value: unknown): unknown =>
    typeof value === 'string' ? value.toLowerCase() : value

// An access list is a JSON-shaped array; comparing its text keeps the diff
// readable without teaching the diff about arrays.
const accessListText = (value: unknown): string => JSON.stringify(value ?? [])

export const compareEvmIntent = (
    intent: EvmTxnIntent,
    transaction: ComparableEvmTransaction,
): EvmIntentComparison => {
    const expected: Record<string, unknown> = {
        type: 'eip1559',
        chainId: intent.chainId,
        from: lowercase(intent.from),
        nonce: intent.nonce,
        to: lowercase(intent.to),
        value: intent.value ?? 0n,
        data: lowercase(intent.data ?? '0x'),
        gas: intent.gas,
        maxFeePerGas: intent.maxFeePerGas,
        maxPriorityFeePerGas: intent.maxPriorityFeePerGas,
        accessList: '[]',
    }
    // RLP encodes zero, empty calldata and a creation's recipient as nothing,
    // so a decoder that leaves them out is reporting 0, `0x` and no recipient,
    // not a missing field.
    const actual: Record<string, unknown> = {
        type: transaction.type,
        chainId: transaction.chainId,
        from: lowercase(transaction.from),
        nonce: transaction.nonce,
        to: lowercase(transaction.to ?? null),
        value: transaction.value ?? 0n,
        data: lowercase(transaction.data ?? transaction.input ?? '0x'),
        gas: transaction.gas,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ?? 0n,
        accessList: accessListText(transaction.accessList),
    }
    return {
        ok: formatFieldDiff(expected, actual) === '',
        expected,
        actual,
    }
}
