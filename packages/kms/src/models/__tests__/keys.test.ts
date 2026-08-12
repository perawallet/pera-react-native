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
    algo25SignKeyId,
    FALCON_CHILD_KEY_TYPE,
    quantumSignKeyId,
} from '../keys'

describe('quantumSignKeyId', () => {
    test('appends the scheme-agnostic -quantum suffix to the seed id', () => {
        expect(quantumSignKeyId('seed-1')).toBe('seed-1-quantum')
    })

    test('never bakes the concrete algorithm into the persisted id', () => {
        // account.keyPairId persists this id — a future scheme swap must not
        // require a keyPairId migration.
        expect(quantumSignKeyId('seed-1')).not.toContain('falcon')
    })

    test('sits alongside algo25SignKeyId with the same shape', () => {
        expect(algo25SignKeyId('seed-1')).toBe('seed-1-ed25519')
        expect(quantumSignKeyId('seed-1')).toBe('seed-1-quantum')
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
