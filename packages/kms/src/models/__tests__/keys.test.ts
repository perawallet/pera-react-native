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
    FALCON_CHILD_KEY_TYPE,
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    quantumSignKeyId,
} from '../keys'

describe('PQDerivation constants', () => {
    // `extensions/provider` cannot import these (workspace cycle) so it
    // declares its own copies of the literals. Pinning the values here, not
    // just the id shapes below, is what keeps that duplication safe — a
    // drifted literal on either side would silently break the provider's
    // ability to recognise legacy vs. canonical children.
    test('legacy derivation is the literal "legacy"', () => {
        expect(PQ_DERIVATION_LEGACY).toBe('legacy')
    })

    test('canonical derivation is the literal "pqk1"', () => {
        expect(PQ_DERIVATION_CANONICAL).toBe('pqk1')
    })
})

describe('quantumSignKeyId', () => {
    test('legacy derivation keeps the historical id', () => {
        // Existing accounts persist this exact string as `keyPairId`. Changing
        // it orphans every quantum account created before PERA-4972.
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_LEGACY)).toBe(
            'seed-1-quantum',
        )
    })

    test('canonical derivation gets a distinct id', () => {
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL)).toBe(
            'seed-1-quantum-pqk1',
        )
    })

    test('the two derivations never collide for one seed', () => {
        // A single seed hosts both children once dual-derivation import lands.
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_LEGACY)).not.toBe(
            quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL),
        )
    })

    test('does not name the signature algorithm', () => {
        expect(
            quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL),
        ).not.toContain('falcon')
    })
})

describe('FALCON_CHILD_KEY_TYPE', () => {
    // Spelled exactly as keystore-core's KeyType: the engine stamps this
    // literal onto the entry it generates, so a drifted spelling would make
    // every "is this child quantum?" guard read false.
    test('names the concrete algorithm on the keystore child entry', () => {
        expect(FALCON_CHILD_KEY_TYPE).toBe('falcon-1024')
    })
})
