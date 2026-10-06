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
import { base32nopad } from '@scure/base'
import { backupIdToAddress } from '../backupIdToAddress'
import { deriveBackupId } from '../deriveBackupId'

const ADDRESS = 'DACRSHIYIZJMAW7C42ORH2BNF54SPP4SF6B5A4ZB47OMOLPY3QXUX3WV54'

const AUTH_PUBLIC_KEY = Uint8Array.from(
    Buffer.from(
        '1805191d184652c05be2e69d13e82d2f7927bf922f83d07321e7dcc72df8dc2f',
        'hex',
    ),
)

describe('deriveBackupId', () => {
    test('formats the backupId as did:pera:<algorand address>', () => {
        expect(deriveBackupId(AUTH_PUBLIC_KEY)).toBe(`did:pera:${ADDRESS}`)
    })

    test('derives the all-zero key to its fixed id', () => {
        expect(deriveBackupId(new Uint8Array(32))).toBe(
            'did:pera:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        )
    })

    test('round-trips back to the auth public key', () => {
        const key = new Uint8Array(32).fill(7)

        const decoded = base32nopad.decode(
            backupIdToAddress(deriveBackupId(key)),
        )

        expect(decoded.slice(0, 32)).toEqual(key)
    })
})

describe('backupIdToAddress', () => {
    test('strips the did:pera: prefix to the bare address', () => {
        expect(backupIdToAddress(`did:pera:${ADDRESS}`)).toBe(ADDRESS)
    })

    test('returns the input unchanged when it has no prefix', () => {
        expect(backupIdToAddress(ADDRESS)).toBe(ADDRESS)
    })
})
