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

import { describe, test, expect, vi, afterEach } from 'vitest'
import { base32nopad } from '@scure/base'
import nacl from 'tweetnacl'
import { backupIdToAddress } from '../backupIdToAddress'
import { buildBackupRegisterProof } from '../buildBackupRegisterProof'
import { BACKUP_PROOF_PREFIX, encodeBackupId } from '../wireFormat'

const ADDRESS = 'DACRSHIYIZJMAW7C42ORH2BNF54SPP4SF6B5A4ZB47OMOLPY3QXUX3WV54'

const AUTH_PUBLIC_KEY = Uint8Array.from(
    Buffer.from(
        '1805191d184652c05be2e69d13e82d2f7927bf922f83d07321e7dcc72df8dc2f',
        'hex',
    ),
)

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('BACKUP_PROOF_PREFIX', () => {
    test('is the prefix the backend verifies', () => {
        expect(BACKUP_PROOF_PREFIX).toBe('MX')
    })

    test('the register proof is byte-identical for a fixed clock and nonce', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_700_000_000_000)
        vi.spyOn(nacl, 'randomBytes').mockReturnValue(new Uint8Array(16))
        const keyPair = nacl.sign.keyPair.fromSeed(
            Uint8Array.from(
                Buffer.from(
                    'ce7819d8a0f71ee84da37299c3fbd602e149c6d62f2525be0205207284fc2aa0',
                    'hex',
                ),
            ),
        )

        const proof = buildBackupRegisterProof({
            backupId: `did:pera:${ADDRESS}`,
            deviceId: 'device-123',
            publicKey: 'GAUZHRhGUsBb4uadE+gtL3knv5Ivg9BzIefcxy343C8=',
            authSecretKey: keyPair.secretKey,
        })

        expect(proof).toEqual({
            nonce: '1700000000000.AAAAAAAAAAAAAAAAAAAAAA==',
            signature:
                '+GPeqX6mXQ97HdBPSmyWLQZIAmVws2o2Q4DDUxbj9G1IQapqbsf877lwyGcAgHTWodnbDnTWLBrBdlu/u2pHDw==',
        })
    })
})

describe('encodeBackupId', () => {
    test('formats the backupId as did:pera:<address>', () => {
        expect(encodeBackupId(AUTH_PUBLIC_KEY)).toBe(`did:pera:${ADDRESS}`)
    })

    test('derives the all-zero key to its fixed id', () => {
        expect(encodeBackupId(new Uint8Array(32))).toBe(
            'did:pera:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        )
    })

    test('round-trips back to the auth public key', () => {
        const key = new Uint8Array(32).fill(7)

        const decoded = base32nopad.decode(
            backupIdToAddress(encodeBackupId(key)),
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
