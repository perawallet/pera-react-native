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

import { describe, test, expect } from 'vitest'
import {
    calculateTotalFee,
    detectHighGroupFee,
    maxReasonableGroupFee,
} from '../fees'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'

const makeTx = (
    fee?: bigint,
    txType = 'pay',
    sender = 'ADDR1',
): PeraDisplayableTransaction =>
    ({
        fee,
        txType,
        sender,
    }) as unknown as PeraDisplayableTransaction

describe('calculateTotalFee', () => {
    test('returns 0 for empty array', () => {
        expect(calculateTotalFee([], new Set()).eq(new Decimal(0))).toBe(true)
    })

    test('sums fees from multiple transactions', () => {
        const txs = [makeTx(1000n), makeTx(2000n), makeTx(3000n)]
        // 6000 microAlgo = 0.006 ALGO
        expect(
            calculateTotalFee(txs, new Set(['ADDR1'])).eq(new Decimal(0.006)),
        ).toBe(true)
    })

    test('treats undefined fee as 0', () => {
        const txs = [makeTx(1000n), makeTx(undefined), makeTx(2000n)]
        // 3000 microAlgo = 0.003 ALGO
        expect(
            calculateTotalFee(txs, new Set(['ADDR1'])).eq(new Decimal(0.003)),
        ).toBe(true)
    })

    test('handles single transaction', () => {
        // 500 microAlgo = 0.0005 ALGO
        expect(
            calculateTotalFee([makeTx(500n)], new Set(['ADDR1'])).eq(
                new Decimal(0.0005),
            ),
        ).toBe(true)
    })
})

describe('maxReasonableGroupFee', () => {
    const signable = new Set(['ADDR1'])

    test('allows 0.5 ALGO per ordinary transaction', () => {
        const txs = [makeTx(1000n), makeTx(1000n), makeTx(1000n)]
        expect(maxReasonableGroupFee(txs, signable)).toBe(1_500_000n)
    })

    test('allows 5 ALGO for a signable keyreg transaction', () => {
        expect(maxReasonableGroupFee([makeTx(1000n, 'keyreg')], signable)).toBe(
            5_000_000n,
        )
    })

    test('sums per-type allowances across a mixed group', () => {
        // keyreg (5 ALGO) + 15 ordinary (0.5 ALGO each = 7.5 ALGO)
        const txs = [
            makeTx(1000n, 'keyreg'),
            ...Array.from({ length: 15 }, () => makeTx(1000n)),
        ]
        expect(maxReasonableGroupFee(txs, signable)).toBe(12_500_000n)
    })

    test('a foreign keyreg only earns the default allowance', () => {
        // The user does not sign ADDR2's keyreg — it must not inflate the
        // budget for fees the user pays.
        const txs = [makeTx(1000n, 'keyreg', 'ADDR2')]
        expect(maxReasonableGroupFee(txs, signable)).toBe(500_000n)
    })
})

describe('detectHighGroupFee', () => {
    const signable = new Set(['ADDR1'])

    test('returns null when the signable fee is within budget', () => {
        // single keyreg paying the 2 ALGO incentive fee — under the 5 ALGO cap
        expect(
            detectHighGroupFee([makeTx(2_000_000n, 'keyreg')], signable),
        ).toBeNull()
    })

    test('flags a single payment with a drain-level fee', () => {
        const warning = detectHighGroupFee([makeTx(10_000_000n)], signable)
        expect(warning).toEqual({ type: 'high-fee', totalFee: 10_000_000n })
    })

    test('only counts fees on the user’s signable transactions', () => {
        // ADDR2 pays the huge fee but the user does not sign it → no warning.
        const txs = [
            makeTx(1000n, 'pay', 'ADDR1'),
            makeTx(50_000_000n, 'pay', 'ADDR2'),
        ]
        expect(detectHighGroupFee(txs, signable)).toBeNull()
    })

    test('budget scales with group size (fee pooling not flagged)', () => {
        // One signed tx pays the whole 16-tx group fee: 16 * 0.5 = 8 ALGO
        // budget. A pooled 7.9 ALGO fee stays within budget.
        const txs = [
            makeTx(7_900_000n, 'pay', 'ADDR1'),
            ...Array.from({ length: 15 }, () => makeTx(0n, 'pay', 'ADDR2')),
        ]
        expect(detectHighGroupFee(txs, signable)).toBeNull()
    })

    test('flags when the pooled fee exceeds the whole-group budget', () => {
        const txs = [
            makeTx(9_000_000n, 'pay', 'ADDR1'),
            ...Array.from({ length: 15 }, () => makeTx(0n, 'pay', 'ADDR2')),
        ]
        expect(detectHighGroupFee(txs, signable)).toEqual({
            type: 'high-fee',
            totalFee: 9_000_000n,
        })
    })

    test('keyreg-padding cannot inflate the budget past the warning', () => {
        // Attack shape: 15 zero-fee keyregs from the attacker's own address.
        // If foreign keyregs earned the 5 ALGO allowance the budget would be
        // 75.5 ALGO; with the signable-only rule it stays 0.5 * 16 = 8 ALGO,
        // so a 10 ALGO fee on the user's payment still warns.
        const txs = [
            makeTx(10_000_000n, 'pay', 'ADDR1'),
            ...Array.from({ length: 15 }, () => makeTx(0n, 'keyreg', 'ADDR2')),
        ]
        expect(detectHighGroupFee(txs, signable)).toEqual({
            type: 'high-fee',
            totalFee: 10_000_000n,
        })
    })
})
