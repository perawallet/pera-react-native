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
import type { SigningCredential } from '../../models'
import { credentialScheme } from '../credentialScheme'

type Keys = NonNullable<Parameters<typeof credentialScheme>[1]>

const local = (
    keyPairId: string,
    provenance: 'algo25' | 'quantum',
): SigningCredential => ({ kind: 'local', keyPairId, provenance })

const seedWithChild = (
    scheme: 'algo25' | 'quantum' | 'bip39',
    childType: string,
): Keys =>
    [
        { id: 'seed', type: 'seed', metadata: { scheme } },
        { id: 'child', type: childType, metadata: { parentKeyId: 'seed' } },
    ] as unknown as Keys

describe('credentialScheme', () => {
    test('resolves ed25519 for a key under an algo25 seed', () => {
        expect(
            credentialScheme(
                local('child', 'algo25'),
                seedWithChild('algo25', 'ed25519'),
            ),
        ).toBe('ed25519')
    })

    test('resolves falcon-1024 for a key under a quantum seed', () => {
        expect(
            credentialScheme(
                local('child', 'quantum'),
                seedWithChild('quantum', 'falcon-1024'),
            ),
        ).toBe('falcon-1024')
    })

    test("follows the seed's scheme when the child entry carries a legacy type", () => {
        expect(
            credentialScheme(
                local('child', 'quantum'),
                seedWithChild('quantum', 'falcon1024'),
            ),
        ).toBe('falcon-1024')
    })

    test('follows the seed over the provenance when they disagree', () => {
        expect(
            credentialScheme(
                local('child', 'quantum'),
                seedWithChild('algo25', 'ed25519'),
            ),
        ).toBe('ed25519')
    })

    test.each([
        ['quantum', 'falcon-1024'],
        ['algo25', 'ed25519'],
    ] as const)(
        'falls back to the %s provenance while the keystore is not loaded',
        (provenance, expected) => {
            expect(credentialScheme(local('missing', provenance), [])).toBe(
                expected,
            )
        },
    )

    test('falls back to ed25519 for a bip39 key whose keystore entry is not loaded', () => {
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
