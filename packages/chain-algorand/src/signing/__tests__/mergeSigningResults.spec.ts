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
    generateAccount,
    makePaymentTxnWithSuggestedParamsFromObject,
    encodeMsgpack,
} from 'algosdk'
import { mergeSigningResults } from '../mergeSigningResults'
import type { SigningResult } from '@perawallet/wallet-core-signing'
import type {
    PeraSignedTransaction,
    SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'

const makeSigned = (id: string): PeraSignedTransaction =>
    ({ txID: id, blob: new Uint8Array() }) as unknown as PeraSignedTransaction

const SIGNER = generateAccount()

// Real signed bytes, so a test proves what the planner signed is what gets delivered.
const signedPayment = (amount: number): Uint8Array =>
    makePaymentTxnWithSuggestedParamsFromObject({
        sender: SIGNER.addr,
        receiver: SIGNER.addr,
        amount,
        suggestedParams: {
            fee: 1000,
            minFee: 1000,
            firstValid: 1,
            lastValid: 1000,
            genesisHash: new Uint8Array(32),
            genesisID: 'testnet-v1.0',
        },
    }).signTxn(SIGNER.sk)

const plannerBytes = new Map<string, Uint8Array>()

const makePlannerSigned = (id: string): SignedTransaction => {
    const bytes = plannerBytes.get(id) ?? signedPayment(plannerBytes.size + 1)
    plannerBytes.set(id, bytes)
    return {
        scope: { chainId: 'algorand', networkId: 'mainnet' },
        id,
        bytes,
    }
}

const amountOf = (signed: PeraSignedTransaction): bigint =>
    (signed.txn as unknown as { payment: { amount: bigint } }).payment.amount

const plannerResult = (
    ids: string[],
    originalIndices: number[],
): SigningResult => ({
    signedData: {
        type: 'signed-transactions',
        signed: ids.map(makePlannerSigned),
        historyEntries: [],
    },
    signers: [{ address: `ADDR_${ids[0]}` }],
    originalIndices,
})

describe('mergeSigningResults', () => {
    test('delivers planner-signed groups as the transactions they sign, in request order', () => {
        const groups = [
            plannerResult(['tx0', 'tx2'], [0, 2]),
            plannerResult(['tx1'], [1]),
        ]

        const merged = mergeSigningResults(groups)

        expect(merged.signedData.type).toBe('transactions')
        if (merged.signedData.type !== 'transactions') return
        expect(
            merged.signedData.signed.map(signed =>
                encodeMsgpack(signed as never),
            ),
        ).toEqual(['tx0', 'tx1', 'tx2'].map(id => plannerBytes.get(id)))
        expect(merged.signers).toEqual([
            { address: 'ADDR_tx0' },
            { address: 'ADDR_tx1' },
        ])
    })

    test('delivers one group of planner-signed and Algorand-signed results together', () => {
        const planned = plannerResult(['tx0'], [0])
        const algorandSigned: SigningResult = {
            signedData: {
                type: 'transactions',
                signed: [makeSigned('tx1')],
            },
            signers: [{ address: 'ADDR_B' }],
            originalIndices: [1],
        }

        const merged = mergeSigningResults([planned, algorandSigned])

        expect(merged.signedData.type).toBe('transactions')
        if (merged.signedData.type !== 'transactions') return
        expect(amountOf(merged.signedData.signed[0])).toBe(1n)
        expect(merged.signedData.signed[1]).toBe(
            algorandSigned.signedData.type === 'transactions'
                ? algorandSigned.signedData.signed[0]
                : undefined,
        )
    })

    test('delivers a single planner-signed group as transactions', () => {
        const merged = mergeSigningResults([plannerResult(['tx9'], [0])])

        expect(merged.signedData.type).toBe('transactions')
    })

    test('returns the single result unchanged when given one result', () => {
        const single: SigningResult = {
            signedData: {
                type: 'transactions',
                signed: [makeSigned('tx0'), makeSigned('tx1')],
            },
            signers: [{ address: 'ADDR_A' }],
        }

        const merged = mergeSigningResults([single])

        expect(merged).toBe(single)
    })

    test('reassembles multi-group results using originalIndices', () => {
        const groupA: SigningResult = {
            signedData: {
                type: 'transactions',
                signed: [makeSigned('tx0'), makeSigned('tx2')],
            },
            signers: [{ address: 'ADDR_A' }],
            originalIndices: [0, 2],
        }

        const groupB: SigningResult = {
            signedData: {
                type: 'transactions',
                signed: [makeSigned('tx1'), makeSigned('tx3')],
            },
            signers: [{ address: 'ADDR_B' }],
            originalIndices: [1, 3],
        }

        const merged = mergeSigningResults([groupA, groupB])

        expect(merged.signedData.type).toBe('transactions')
        if (merged.signedData.type === 'transactions') {
            expect(merged.signedData.signed).toHaveLength(4)
            expect((merged.signedData.signed[0] as any).txID).toBe('tx0')
            expect((merged.signedData.signed[1] as any).txID).toBe('tx1')
            expect((merged.signedData.signed[2] as any).txID).toBe('tx2')
            expect((merged.signedData.signed[3] as any).txID).toBe('tx3')
        }

        expect(merged.signers).toEqual([
            { address: 'ADDR_A' },
            { address: 'ADDR_B' },
        ])
    })

    test('handles results without originalIndices gracefully', () => {
        const groupA: SigningResult = {
            signedData: {
                type: 'transactions',
                signed: [makeSigned('tx0')],
            },
            signers: [{ address: 'ADDR_A' }],
        }

        const groupB: SigningResult = {
            signedData: {
                type: 'transactions',
                signed: [makeSigned('tx1')],
            },
            signers: [{ address: 'ADDR_B' }],
        }

        const merged = mergeSigningResults([groupA, groupB])

        // Without originalIndices, totalCount is 0, so signed array is empty
        expect(merged.signedData.type).toBe('transactions')
        if (merged.signedData.type === 'transactions') {
            expect(merged.signedData.signed).toHaveLength(0)
        }
        expect(merged.signers).toHaveLength(2)
    })

    test('merges signers from all groups', () => {
        const results: SigningResult[] = [
            {
                signedData: {
                    type: 'transactions',
                    signed: [makeSigned('tx0')],
                },
                signers: [{ address: 'ADDR_A' }],
                originalIndices: [0],
            },
            {
                signedData: {
                    type: 'transactions',
                    signed: [makeSigned('tx1')],
                },
                signers: [{ address: 'ADDR_B' }, { address: 'ADDR_C' }],
                originalIndices: [1],
            },
        ]

        const merged = mergeSigningResults(results)

        expect(merged.signers).toEqual([
            { address: 'ADDR_A' },
            { address: 'ADDR_B' },
            { address: 'ADDR_C' },
        ])
    })
})
