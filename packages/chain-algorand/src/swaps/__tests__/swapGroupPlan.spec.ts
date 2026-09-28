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

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionGroup } from '@perawallet/wallet-core-swaps'
import { buildGroupPlans, scatterSigned } from '../swapGroupPlan'

vi.mock('@perawallet/wallet-core-shared', () => ({
    decodeFromBase64: (b64: string) => new TextEncoder().encode(b64),
}))

const makeUnsignedTxn = (tag: string): PeraTransaction =>
    ({ tag }) as unknown as PeraTransaction

const makeSignedTxn = (tag: string): PeraSignedTransaction =>
    ({
        tag,
        txn: makeUnsignedTxn(`inner-${tag}`),
    }) as unknown as PeraSignedTransaction

const decoders = {
    decodeTransaction: (bytes: Uint8Array) =>
        makeUnsignedTxn(new TextDecoder().decode(bytes)),
    decodeSignedTransaction: (bytes: Uint8Array) =>
        makeSignedTxn(new TextDecoder().decode(bytes)),
}

describe('buildGroupPlans', () => {
    it('produces a plan with all unsigned slots for a single all-unsigned group', () => {
        const groups: TransactionGroup[] = [
            { purpose: 'swap', transactions: ['a', 'b'] },
        ]

        const { plans, unsignedTxs, groupContext } = buildGroupPlans(
            groups,
            decoders,
        )

        expect(plans).toHaveLength(1)
        expect(plans[0].slots).toEqual([
            { kind: 'toSign', flatIndex: 0 },
            { kind: 'toSign', flatIndex: 1 },
        ])
        expect(unsignedTxs).toHaveLength(2)
        expect(groupContext).toEqual(unsignedTxs)
    })

    it('produces a plan with all pre-signed slots for a single all-pre-signed group', () => {
        const groups: TransactionGroup[] = [
            { purpose: 'fee', signedTransactions: ['x', 'y'] },
        ]

        const { plans, unsignedTxs, groupContext } = buildGroupPlans(
            groups,
            decoders,
        )

        expect(plans[0].slots.every(s => s.kind === 'preSigned')).toBe(true)
        expect(unsignedTxs).toHaveLength(0)
        expect(groupContext).toHaveLength(2)
        // groupContext entries for pre-signed slots are the inner unsigned-form.
        expect(groupContext[0]).toEqual(
            (plans[0].slots[0] as { signed: PeraSignedTransaction }).signed.txn,
        )
    })

    it('interleaves pre-signed and user-signed slots inside a single mixed group', () => {
        // 3 slots: pre, user, pre.
        const groups: TransactionGroup[] = [
            {
                purpose: 'swap',
                signedTransactions: ['p1', null, 'p2'],
                transactions: [null, 'u1', null],
            },
        ]

        const { plans, unsignedTxs, groupContext } = buildGroupPlans(
            groups,
            decoders,
        )

        expect(unsignedTxs).toHaveLength(1)
        expect(plans[0].slots).toEqual([
            { kind: 'preSigned', signed: makeSignedTxn('p1') },
            { kind: 'toSign', flatIndex: 0 },
            { kind: 'preSigned', signed: makeSignedTxn('p2') },
        ])

        // groupContext must include EVERY slot (pre-signed + unsigned), in
        // submission order — this is the payload the analyzer validates.
        expect(groupContext).toHaveLength(3)
        expect(groupContext[1]).toBe(unsignedTxs[0])
    })

    it('produces one plan per group and concatenates groupContext across groups', () => {
        const groups: TransactionGroup[] = [
            { purpose: 'opt-in', transactions: ['a'] },
            {
                purpose: 'swap',
                signedTransactions: ['p', null],
                transactions: [null, 'b'],
            },
        ]

        const { plans, unsignedTxs, groupContext } = buildGroupPlans(
            groups,
            decoders,
        )

        expect(plans).toHaveLength(2)
        expect(unsignedTxs).toHaveLength(2)
        expect(groupContext).toHaveLength(3) // 1 + 2 slots
    })
})

describe('scatterSigned', () => {
    it('reassembles signed txns back into their original group slots', () => {
        const groups: TransactionGroup[] = [
            {
                purpose: 'swap',
                signedTransactions: ['p1', null, 'p2'],
                transactions: [null, 'u1', null],
            },
        ]

        const { plans } = buildGroupPlans(groups, decoders)
        const userSigned = makeSignedTxn('user-signed')

        const result = scatterSigned(plans, [userSigned])

        expect(result).toHaveLength(1)
        expect(result[0]).toHaveLength(3)
        expect(result[0][0]).toEqual(makeSignedTxn('p1'))
        expect(result[0][1]).toBe(userSigned)
        expect(result[0][2]).toEqual(makeSignedTxn('p2'))
    })
})
