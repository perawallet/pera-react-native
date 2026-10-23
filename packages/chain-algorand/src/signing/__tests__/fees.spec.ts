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
import { Decimal } from 'decimal.js'
import type { PeraDisplayableTransaction } from '../../blockchain/models/algosdk-shapes'

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

const padding = (count: number, txType: string, sender: string) =>
    Array.from({ length: count }, () => makeTx(0n, txType, sender))

describe('maxReasonableGroupFee', () => {
    const signable = new Set(['ADDR1'])

    test('allows a flat 0.5 ALGO regardless of group size', () => {
        expect(maxReasonableGroupFee([makeTx(1000n)], signable)).toBe(500_000n)
        expect(
            maxReasonableGroupFee(
                [makeTx(1000n), ...padding(15, 'pay', 'ADDR1')],
                signable,
            ),
        ).toBe(500_000n)
    })

    test('adds the fees on the user’s keyregs to the base allowance', () => {
        expect(
            maxReasonableGroupFee([makeTx(2_000_000n, 'keyreg')], signable),
        ).toBe(2_500_000n)
    })

    test('a zero-fee keyreg adds nothing', () => {
        expect(maxReasonableGroupFee([makeTx(0n, 'keyreg')], signable)).toBe(
            500_000n,
        )
    })

    test('caps the keyreg allowance at 5 ALGO however many keyregs there are', () => {
        const txs = [makeTx(3_000_000n, 'keyreg'), makeTx(3_000_000n, 'keyreg')]
        expect(maxReasonableGroupFee(txs, signable)).toBe(5_500_000n)
    })

    test('a foreign keyreg earns no keyreg allowance', () => {
        const txs = [makeTx(1000n, 'keyreg', 'ADDR2')]
        expect(maxReasonableGroupFee(txs, signable)).toBe(500_000n)
    })
})

describe('detectHighGroupFee', () => {
    const signable = new Set(['ADDR1'])

    test('does not flag a single keyreg paying the incentive-eligibility fee', () => {
        expect(
            detectHighGroupFee([makeTx(2_000_000n, 'keyreg')], signable),
        ).toBeNull()
    })

    test('flags a single payment with a drain-level fee', () => {
        const warning = detectHighGroupFee([makeTx(10_000_000n)], signable)
        expect(warning).toEqual({ type: 'high-fee', totalFee: 10_000_000n })
    })

    test.each([
        [500_000n, null],
        [500_001n, { type: 'high-fee', totalFee: 500_001n }],
    ])(
        'a %s µAlgo fee against the 0.5 ALGO allowance → %o',
        (fee, expected) => {
            expect(detectHighGroupFee([makeTx(fee)], signable)).toEqual(
                expected,
            )
        },
    )

    test('a zero-fee keyreg of the user’s own does not cover a high fee elsewhere', () => {
        const txs = [
            makeTx(4_900_000n, 'pay', 'ADDR1'),
            makeTx(0n, 'keyreg', 'ADDR1'),
        ]
        expect(detectHighGroupFee(txs, signable)).toEqual({
            type: 'high-fee',
            totalFee: 4_900_000n,
        })
    })

    test('only counts fees on the user’s signable transactions', () => {
        const txs = [
            makeTx(1000n, 'pay', 'ADDR1'),
            makeTx(50_000_000n, 'pay', 'ADDR2'),
        ]
        expect(detectHighGroupFee(txs, signable)).toBeNull()
    })

    test('does not flag fee pooling across a full group', () => {
        const txs = [
            makeTx(16_000n, 'pay', 'ADDR1'),
            ...padding(15, 'pay', 'ADDR2'),
        ]
        expect(detectHighGroupFee(txs, signable)).toBeNull()
    })

    test.each([
        ['a foreign sender', 'ADDR2'],
        ['the user’s own address', 'ADDR1'],
    ])(
        'zero-fee padding from %s does not suppress the warning',
        (_, sender) => {
            const txs = [
                makeTx(2_000_000n, 'pay', 'ADDR1'),
                ...padding(15, 'pay', sender),
            ]
            expect(detectHighGroupFee(txs, signable)).toEqual({
                type: 'high-fee',
                totalFee: 2_000_000n,
            })
        },
    )

    test.each([
        ['a foreign sender', 'ADDR2'],
        ['the user’s own address', 'ADDR1'],
    ])(
        'keyreg padding from %s does not multiply the keyreg allowance',
        (_, sender) => {
            const txs = [
                makeTx(10_000_000n, 'keyreg', 'ADDR1'),
                ...padding(15, 'keyreg', sender),
            ]
            expect(detectHighGroupFee(txs, signable)).toEqual({
                type: 'high-fee',
                totalFee: 10_000_000n,
            })
        },
    )
})
