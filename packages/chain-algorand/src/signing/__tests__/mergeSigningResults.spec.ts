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
import { mergeSigningResults } from '../mergeSigningResults'
import {
    SigningError,
    type SigningResult,
    type SubmissionHistoryEntry,
} from '@perawallet/wallet-core-signing'
import type {
    PeraSignedTransaction,
    SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'

const makeSigned = (id: string): PeraSignedTransaction =>
    ({ txID: id, blob: new Uint8Array() }) as unknown as PeraSignedTransaction

const makePlannerSigned = (id: string): SignedTransaction => ({
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    id,
    bytes: new Uint8Array(),
})

const makeHistoryEntry = (id: string): SubmissionHistoryEntry => ({
    summary: {
        kind: 'transfer',
        title: { key: id },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'algorand' },
})

const plannerResult = (
    ids: string[],
    originalIndices: number[],
): SigningResult => ({
    signedData: {
        type: 'signed-transactions',
        signed: ids.map(makePlannerSigned),
        historyEntries: ids.map(makeHistoryEntry),
    },
    signers: [{ address: `ADDR_${ids[0]}` }],
    originalIndices,
})

describe('mergeSigningResults', () => {
    test('reassembles planner-signed groups in request order', () => {
        const merged = mergeSigningResults([
            plannerResult(['tx0', 'tx2'], [0, 2]),
            plannerResult(['tx1'], [1]),
        ])

        expect(merged).toEqual({
            signedData: {
                type: 'signed-transactions',
                signed: ['tx0', 'tx1', 'tx2'].map(makePlannerSigned),
                historyEntries: ['tx0', 'tx1', 'tx2'].map(makeHistoryEntry),
            },
            signers: [{ address: 'ADDR_tx0' }, { address: 'ADDR_tx1' }],
        })
    })

    test('refuses for good to merge planner-signed and Algorand-signed groups rather than drop either', () => {
        const algorandSigned: SigningResult = {
            signedData: { type: 'transactions', signed: [makeSigned('tx1')] },
            signers: [{ address: 'ADDR_B' }],
            originalIndices: [1],
        }

        const merge = () =>
            mergeSigningResults([plannerResult(['tx0'], [0]), algorandSigned])

        expect(merge).toThrow(SigningError)
        expect(merge).toThrow(
            expect.objectContaining({
                metadata: expect.objectContaining({ retryable: false }),
            }),
        )
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
