/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { resolveSignableTransactions } from '../resolveSignableTransactions'

describe('resolveSignableTransactions', () => {
    const signableAddresses = new Set(['addr1', 'addr2'])

    test('signs transaction when signers is absent and sender is signable', () => {
        const result = resolveSignableTransactions(
            [{}],
            ['addr1'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([0])
        expect(result.signerOverrides.size).toBe(0)
    })

    test('skips transaction when signers is empty array (dApp-signed)', () => {
        const result = resolveSignableTransactions(
            [{ signers: [] }],
            ['addr1'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([])
    })

    test('signs transaction when signers contains a signable address', () => {
        const result = resolveSignableTransactions(
            [{ signers: ['addr1'] }],
            ['addr1'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([0])
        expect(result.signerOverrides.size).toBe(0)
    })

    test('skips transaction when signers contains only unknown addresses', () => {
        const result = resolveSignableTransactions(
            [{ signers: ['unknown'] }],
            ['unknown'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([])
    })

    test('skips transaction when sender is not signable and signers is absent', () => {
        const result = resolveSignableTransactions(
            [{}],
            ['unknown'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([])
    })

    test('sets signerOverride when signer differs from sender (rekey case)', () => {
        const result = resolveSignableTransactions(
            [{ signers: ['addr1'] }],
            ['contract-addr'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([0])
        expect(result.signerOverrides.get(0)).toBe('addr1')
    })

    test('handles mixed transaction group', () => {
        const result = resolveSignableTransactions(
            [
                {}, // signers absent, sender is signable → sign (index 0)
                { signers: [] }, // dApp-signed → skip
                { signers: ['addr2'] }, // signers match → sign (index 2)
                { signers: ['unknown'] }, // no match → skip
                {}, // signers absent, sender not signable → skip
            ],
            ['addr1', 'addr1', 'addr2', 'unknown', 'contract'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([0, 2])
        expect(result.signerOverrides.size).toBe(0)
    })

    test('returns empty result when no transactions need signing', () => {
        const result = resolveSignableTransactions(
            [{ signers: [] }, { signers: [] }],
            ['addr1', 'addr2'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([])
        expect(result.signerOverrides.size).toBe(0)
    })

    test('signerOverride index is relative to indicesToSign position', () => {
        const result = resolveSignableTransactions(
            [
                { signers: [] }, // skip
                { signers: ['addr1'] }, // sign → indicesToSign[0], override because sender differs
                { signers: [] }, // skip
                { signers: ['addr2'] }, // sign → indicesToSign[1], no override (sender matches)
            ],
            ['x', 'contract', 'x', 'addr2'],
            signableAddresses,
        )

        expect(result.indicesToSign).toEqual([1, 3])
        expect(result.signerOverrides.get(0)).toBe('addr1')
        expect(result.signerOverrides.has(1)).toBe(false)
    })
})
