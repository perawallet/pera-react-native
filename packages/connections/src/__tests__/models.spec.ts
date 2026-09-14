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
import { WALLET_OPERATION_TYPES, matchesScope } from '../models'

describe('wallet operation vocabulary', () => {
    it('is closed to the two ARC-defined operations', () => {
        // The union is deliberately closed: handlers reject what they cannot
        // map rather than emitting an `unknown` variant every consumer must
        // then handle forever.
        expect(WALLET_OPERATION_TYPES).toEqual([
            'sign-transactions',
            'sign-data',
        ])
    })
})

describe('matchesScope', () => {
    it('matches on the pairing id or the connection id, whichever the scope names', () => {
        expect(matchesScope({ pairingId: 'p1' }, { pairingId: 'p1' })).toBe(
            true,
        )
        expect(
            matchesScope({ connectionId: 'c1' }, { connectionId: 'c1' }),
        ).toBe(true)
        expect(matchesScope({ pairingId: 'p1' }, { pairingId: 'p2' })).toBe(
            false,
        )
    })

    // A pairing and the connection it becomes share an id on v1 only, so the
    // two fields are never compared against each other.
    it('never matches a pairing id against a connection id', () => {
        expect(
            matchesScope({ pairingId: 'same' }, { connectionId: 'same' }),
        ).toBe(false)
        expect(
            matchesScope({ connectionId: 'same' }, { pairingId: 'same' }),
        ).toBe(false)
    })

    it('does not match an empty scope or an empty subject', () => {
        expect(matchesScope({ pairingId: 'p1' }, {})).toBe(false)
        expect(matchesScope({}, { pairingId: 'p1' })).toBe(false)
    })
})
