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

import type { Key } from '@algorandfoundation/keystore-core'
import { describe, expect, test } from 'vitest'

import { SeedScheme } from '../../../constants'
import {
    InvalidKeyError,
    KeyManagementError,
    KeyNotFoundError,
} from '../../../errors'
import { FALCON_CHILD_KEY_TYPE } from '../../../models/keys'
import {
    resolvePQSigningInfo,
    resolveSeedKeyFrom,
} from '../resolvePQSigningInfo'

const seed = (id: string, scheme: SeedScheme): Key =>
    ({
        id,
        type: 'seed',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme },
    }) as Key

const child = (id: string, parentKeyId: string, type: string): Key =>
    ({
        id,
        type,
        algorithm: 'raw',
        extractable: false,
        publicKey: new Uint8Array([10, 1, 2, 3]),
        metadata: { parentKeyId },
    }) as unknown as Key

describe('resolveSeedKeyFrom', () => {
    test('walks a child to its parent seed', () => {
        const keys = [
            seed('s1', SeedScheme.Algo25),
            child('s1-ed25519', 's1', 'ed25519'),
        ]

        expect(resolveSeedKeyFrom(keys, 's1-ed25519').id).toBe('s1')
    })

    test('accepts a seed id passed directly', () => {
        const keys = [seed('s1', SeedScheme.Quantum)]

        expect(resolveSeedKeyFrom(keys, 's1').id).toBe('s1')
    })

    test('throws KeyNotFoundError for an id that is absent entirely', () => {
        expect(() => resolveSeedKeyFrom([], 'missing')).toThrow(
            KeyNotFoundError,
        )
    })

    test('throws KeyNotFoundError when the named parent is absent', () => {
        const keys = [child('orphan', 'gone', 'ed25519')]

        expect(() => resolveSeedKeyFrom(keys, 'orphan')).toThrow(
            KeyNotFoundError,
        )
    })

    // A parentless non-seed is a caller error, not a missing record — the
    // distinction is what tells "you passed the wrong id" from "the keystore
    // lost a key".
    test('throws InvalidKeyError for a parentless key that is not a seed', () => {
        const keys = [
            {
                id: 'loose',
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                metadata: {},
            } as Key,
        ]

        expect(() => resolveSeedKeyFrom(keys, 'loose')).toThrow(InvalidKeyError)
    })
})

describe('resolvePQSigningInfo', () => {
    test('returns null for an ed25519 child so callers take the sig path', () => {
        const keys = [
            seed('s1', SeedScheme.Algo25),
            child('s1-ed25519', 's1', 'ed25519'),
        ]

        expect(resolvePQSigningInfo(keys, 's1-ed25519')).toBeNull()
    })

    test('returns the provider scheme and the child public key for a quantum child', () => {
        const keys = [
            seed('q1', SeedScheme.Quantum),
            child('q1-quantum', 'q1', FALCON_CHILD_KEY_TYPE),
        ]

        const info = resolvePQSigningInfo(keys, 'q1-quantum')

        expect(info?.schemeId).toBe('falcon1024')
        expect(info?.publicKey).toEqual(new Uint8Array([10, 1, 2, 3]))
    })

    // The two oracles disagreeing is the failure mode: returning
    // null here would make the caller sign un-digested bytes while the
    // keystore still Falcon-signs them.
    test('throws when a quantum seed carries a non-Falcon child', () => {
        const keys = [
            seed('q1', SeedScheme.Quantum),
            child('q1-ed25519', 'q1', 'ed25519'),
        ]

        expect(() => resolvePQSigningInfo(keys, 'q1-ed25519')).toThrow(
            KeyManagementError,
        )
    })

    test('throws when a Falcon child hangs off a non-quantum seed', () => {
        const keys = [
            seed('s1', SeedScheme.Algo25),
            child('s1-falcon', 's1', FALCON_CHILD_KEY_TYPE),
        ]

        expect(() => resolvePQSigningInfo(keys, 's1-falcon')).toThrow(
            KeyManagementError,
        )
    })

    // `resolveSeedKeyFrom` accepts a seed id directly, so the quantum SEED's
    // own id reaches the guard: the seed says quantum, the "child" lookup
    // finds the seed itself (type `seed`) and says not-Falcon.
    test('throws when handed the quantum seed id instead of its child', () => {
        const keys = [
            seed('q1', SeedScheme.Quantum),
            child('q1-quantum', 'q1', FALCON_CHILD_KEY_TYPE),
        ]

        expect(() => resolvePQSigningInfo(keys, 'q1')).toThrow(
            KeyManagementError,
        )
    })

    test('throws when a quantum child has no public key to sign under', () => {
        const keys = [
            seed('q1', SeedScheme.Quantum),
            {
                id: 'q1-quantum',
                type: FALCON_CHILD_KEY_TYPE,
                algorithm: 'raw',
                extractable: false,
                metadata: { parentKeyId: 'q1' },
            } as unknown as Key,
        ]

        expect(() => resolvePQSigningInfo(keys, 'q1-quantum')).toThrow(
            /No quantum public key/,
        )
    })
})
