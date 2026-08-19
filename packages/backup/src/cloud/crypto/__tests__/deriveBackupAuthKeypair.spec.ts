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

import { describe, test, expect } from 'vitest'
import nacl from 'tweetnacl'
import { deriveBackupAuthKeypair } from '../deriveBackupAuthKeypair'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

const AUTH_SEED = Uint8Array.from(
    Buffer.from(
        'ce7819d8a0f71ee84da37299c3fbd602e149c6d62f2525be0205207284fc2aa0',
        'hex',
    ),
)

describe('deriveBackupAuthKeypair', () => {
    test('derives a deterministic Ed25519 keypair from the auth seed', () => {
        const { publicKey } = deriveBackupAuthKeypair(AUTH_SEED)

        expect(hex(publicKey)).toBe(
            '1805191d184652c05be2e69d13e82d2f7927bf922f83d07321e7dcc72df8dc2f',
        )
    })

    test('produces a keypair whose signatures verify against the public key', () => {
        const { publicKey, secretKey } = deriveBackupAuthKeypair(AUTH_SEED)
        const message = new TextEncoder().encode('hello')

        const signature = nacl.sign.detached(message, secretKey)

        expect(nacl.sign.detached.verify(message, signature, publicKey)).toBe(
            true,
        )
    })
})
