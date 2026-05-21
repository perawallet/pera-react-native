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

    // =========================================================================
    // Multisig sender routing
    //
    // When the wallet locally holds the multisig sender, the ARC-0001 `signers`
    // field should be ignored for routing — the wallet auto-signs with every
    // local participant via the multisig propose flow, mirroring pera-android.
    // =========================================================================

    describe('multisig sender routing', () => {
        const multisigSignable = new Set([
            'addr1',
            'addr2',
            'participantA',
            'participantB',
            'MSIG_ADDR',
        ])
        const multisigAddresses = new Set(['MSIG_ADDR'])

        test('multisig sender + signers=[participant]: include, no override', () => {
            const result = resolveSignableTransactions(
                [{ signers: ['participantA'] }],
                ['MSIG_ADDR'],
                multisigSignable,
                multisigAddresses,
            )

            expect(result.indicesToSign).toEqual([0])
            expect(result.signerOverrides.size).toBe(0)
        })

        test('multisig sender + signers absent: include, no override (regression)', () => {
            const result = resolveSignableTransactions(
                [{}],
                ['MSIG_ADDR'],
                multisigSignable,
                multisigAddresses,
            )

            expect(result.indicesToSign).toEqual([0])
            expect(result.signerOverrides.size).toBe(0)
        })

        test('multisig sender + signers=[] (dApp opt-out): skip even for multisig', () => {
            const result = resolveSignableTransactions(
                [{ signers: [] }],
                ['MSIG_ADDR'],
                multisigSignable,
                multisigAddresses,
            )

            expect(result.indicesToSign).toEqual([])
        })

        test('multisig sender + signers=[participantWeDontHave]: still include, no override', () => {
            // Wallet doesn't hold `participantX`, only `participantA`. The
            // multisig strategy will still auto-sign with the participants
            // we do have — propose carries whatever we collected.
            const limitedSignable = new Set(['participantA', 'MSIG_ADDR'])
            const result = resolveSignableTransactions(
                [{ signers: ['participantX'] }],
                ['MSIG_ADDR'],
                limitedSignable,
                multisigAddresses,
            )

            expect(result.indicesToSign).toEqual([0])
            expect(result.signerOverrides.size).toBe(0)
        })

        test('non-multisig sender + signers=[participant]: existing override path', () => {
            // Regression: when the sender is NOT a local multisig, the
            // standard ARC-0001 override path still applies.
            const result = resolveSignableTransactions(
                [{ signers: ['addr1'] }],
                ['contract-addr'],
                multisigSignable,
                multisigAddresses,
            )

            expect(result.indicesToSign).toEqual([0])
            expect(result.signerOverrides.get(0)).toBe('addr1')
        })

        test('mixed group: multisig sender at [0], regular at [1]', () => {
            const result = resolveSignableTransactions(
                [
                    { signers: ['participantA'] }, // tx[0]: multisig sender → no override
                    { signers: ['addr1'] }, // tx[1]: regular contract sender → override
                ],
                ['MSIG_ADDR', 'contract-addr'],
                multisigSignable,
                multisigAddresses,
            )

            expect(result.indicesToSign).toEqual([0, 1])
            expect(result.signerOverrides.has(0)).toBe(false)
            expect(result.signerOverrides.get(1)).toBe('addr1')
        })

        test('omitting multisigAddresses defaults to empty set (backward compat)', () => {
            // Without the multisig set, the existing override behavior
            // applies even when the sender is in fact a multisig in some
            // other context. Callers that don't care opt out cleanly.
            const result = resolveSignableTransactions(
                [{ signers: ['participantA'] }],
                ['MSIG_ADDR'],
                multisigSignable,
            )

            expect(result.indicesToSign).toEqual([0])
            expect(result.signerOverrides.get(0)).toBe('participantA')
        })
    })
})
