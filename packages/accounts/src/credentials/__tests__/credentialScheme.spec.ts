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
import { FALCON_CHILD_KEY_TYPE } from '@perawallet/wallet-core-kms'
import type { SigningCredential } from '../../models'
import { credentialScheme } from '../credentialScheme'

const local = (
    keyPairId: string,
    provenance: 'algo25' | 'quantum',
): SigningCredential => ({ kind: 'local', keyPairId, provenance })

describe('credentialScheme', () => {
    test('reads ed25519 from the KMS entry of a local key', () => {
        const keys = [{ id: 'k1', type: 'ed25519' }]

        expect(credentialScheme(local('k1', 'algo25'), keys)).toBe('ed25519')
    })

    test('reads falcon-1024 from the KMS entry of a local key', () => {
        const keys = [{ id: 'k1', type: FALCON_CHILD_KEY_TYPE }]

        expect(credentialScheme(local('k1', 'quantum'), keys)).toBe(
            'falcon-1024',
        )
    })

    test('prefers the KMS entry over the provenance', () => {
        const keys = [{ id: 'k1', type: 'ed25519' }]

        expect(credentialScheme(local('k1', 'quantum'), keys)).toBe('ed25519')
    })

    test.each([
        ['quantum', 'falcon-1024'],
        ['algo25', 'ed25519'],
    ] as const)(
        'falls back to the %s provenance while the KMS entry is not loaded',
        (provenance, expected) => {
            expect(credentialScheme(local('missing', provenance), [])).toBe(
                expected,
            )
        },
    )

    test('falls back to ed25519 for a bip39 key whose KMS entry is not loaded', () => {
        expect(
            credentialScheme(
                {
                    kind: 'local',
                    keyPairId: 'missing',
                    provenance: 'bip39',
                    hd: {
                        account: 0,
                        change: 0,
                        keyIndex: 0,
                        derivationType: 9,
                    },
                },
                [],
            ),
        ).toBe('ed25519')
    })

    test('resolves hardware and multisig credentials to ed25519', () => {
        expect(
            credentialScheme(
                {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'd',
                        deviceName: 'n',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                [],
            ),
        ).toBe('ed25519')
        expect(
            credentialScheme(
                {
                    kind: 'multisig',
                    threshold: 1,
                    members: ['P1'],
                    version: 1,
                },
                [],
            ),
        ).toBe('ed25519')
    })
})
