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

import { describe, expect, it, vi } from 'vitest'

// See 0002-lift-nested-material.spec.ts: the package root executes native
// Keychain/Nitro bindings at import time, so every spec mocks the whole
// module. `classify` only reads the two prefixes, so only `driver.js` (real
// dist, no native deps) is needed here.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')

    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
    }
})

import { classifyRecord, isFlatCandidate } from '../classify'
import type { Canary13Record } from '../../canary13'

const record = (value: object): Canary13Record => value as Canary13Record

describe('isFlatCandidate', () => {
    it('rejects prefixed keys, the ledger key and the layout stamp', () => {
        expect(isFlatCandidate('k/abc')).toBe(false)
        expect(isFlatCandidate('m/abc')).toBe(false)
        expect(isFlatCandidate('@algorandfoundation/provider-migrations')).toBe(
            false,
        )
        expect(isFlatCandidate('pera/keystore-layout-version')).toBe(false)
        expect(isFlatCandidate('abc')).toBe(true)
    })
})

describe('classifyRecord', () => {
    it('reports top-level material', () => {
        expect(
            classifyRecord(
                record({ id: 'a', privateKey: new Uint8Array(32).fill(1) }),
            ),
        ).toBe('material')
        expect(
            classifyRecord(
                record({ id: 'a', seed: new Uint8Array(32).fill(1) }),
            ),
        ).toBe('material')
    })

    it('reports a derived child as nested-only', () => {
        expect(
            classifyRecord(
                record({
                    id: 'a',
                    type: 'hd-derived-ed25519',
                    metadata: {
                        rootKey: { privateKey: new Uint8Array(96).fill(2) },
                    },
                }),
            ),
        ).toBe('nested-only')
    })

    it('reports a biometric-wrapped passkey, which carries no Uint8Array', () => {
        expect(
            classifyRecord(
                record({
                    id: 'a',
                    type: 'hd-derived-p256',
                    privateKeyEnc: { iv: 'aa', data: 'bb' },
                }),
            ),
        ).toBe('wrapped-passkey')
    })

    it('reports a plain passkey credential separately from a seed', () => {
        expect(
            classifyRecord(
                record({
                    id: 'a',
                    type: 'hd-derived-p256',
                    privateKey: new Uint8Array(32).fill(1),
                }),
            ),
        ).toBe('plain-passkey')
    })

    it('reports a record with no material at all', () => {
        expect(classifyRecord(record({ id: 'a', type: 'falcon1024' }))).toBe(
            'material-less',
        )
    })
})
