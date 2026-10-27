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

import { describe, expect, it } from 'vitest'
import { formatFieldDiff } from '@perawallet/conformance/harness/assert/diff'

import {
    compareEvmIntent,
    type ComparableEvmTransaction,
    type EvmTxnIntent,
} from '../intent'

const FROM = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const TO = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

// Never submitted: this file tests the projection, not the chain.
const INTENT: EvmTxnIntent = {
    chainId: 11_155_111,
    from: FROM,
    nonce: 7,
    to: TO,
    value: 300_000n,
    gas: 21_000n,
    maxFeePerGas: 2_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
}

// The node reports addresses lowercase; the comparison must not care.
const matching = (): ComparableEvmTransaction => ({
    type: 'eip1559',
    chainId: 11_155_111,
    from: FROM.toLowerCase(),
    nonce: 7,
    to: TO.toLowerCase(),
    value: 300_000n,
    input: '0x',
    gas: 21_000n,
    maxFeePerGas: 2_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    accessList: [],
})

const diffOf = (
    intent: EvmTxnIntent,
    transaction: ComparableEvmTransaction,
): string => {
    const { expected, actual } = compareEvmIntent(intent, transaction)
    return formatFieldDiff(expected, actual)
}

describe('compareEvmIntent', () => {
    it('accepts a transaction that matches every declared field', () => {
        const comparison = compareEvmIntent(INTENT, matching())

        expect(comparison.ok).toBe(true)
        expect(formatFieldDiff(comparison.expected, comparison.actual)).toBe('')
    })

    it('treats an omitted data field as asserting empty calldata', () => {
        const transaction = { ...matching(), input: '0xa9059cbb' }

        const comparison = compareEvmIntent(INTENT, transaction)

        expect(comparison.ok).toBe(false)
        expect(diffOf(INTENT, transaction)).toMatch(/^data\s+0x\s+0xa9059cbb$/m)
    })

    it('treats an omitted value as asserting zero', () => {
        const { value: _value, ...intent } = INTENT

        expect(diffOf(intent, matching())).toMatch(/^value\s+0n\s+300000n$/m)
    })

    it('shows a number where a bigint belongs instead of passing it', () => {
        const transaction = { ...matching(), value: 300_000 }

        const comparison = compareEvmIntent(INTENT, transaction)

        expect(comparison.ok).toBe(false)
        expect(diffOf(INTENT, transaction)).toMatch(
            /^value\s+300000n\s+300000$/m,
        )
    })

    it('refuses a transaction that is not EIP-1559', () => {
        expect(diffOf(INTENT, { ...matching(), type: 'legacy' })).toMatch(
            /^type\s+eip1559\s+legacy$/m,
        )
    })

    it('refuses a non-empty access list', () => {
        const transaction = {
            ...matching(),
            accessList: [{ address: TO, storageKeys: [] }],
        }

        expect(compareEvmIntent(INTENT, transaction).ok).toBe(false)
    })

    it('compares the recipient of a contract creation as absent', () => {
        const intent = { ...INTENT, to: null }

        expect(diffOf(intent, { ...matching(), to: null })).toBe('')
        expect(diffOf(intent, matching())).toMatch(/^to\s+\(unset\)\s+0x/m)
    })
})
