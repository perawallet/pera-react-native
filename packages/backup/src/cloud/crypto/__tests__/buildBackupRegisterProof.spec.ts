/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    buildBackupRegisterMessage,
    buildBackupRegisterProof,
} from '../buildBackupRegisterProof'

const SEED = Uint8Array.from(
    Buffer.from(
        'ce7819d8a0f71ee84da37299c3fbd602e149c6d62f2525be0205207284fc2aa0',
        'hex',
    ),
)
const KEYPAIR = nacl.sign.keyPair.fromSeed(SEED)
const BACKUP_ID =
    'did:pera:DACRSHIYIZJMAW7C42ORH2BNF54SPP4SF6B5A4ZB47OMOLPY3QXUX3WV54'
const PUBLIC_KEY = 'GAUZHRhGUsBb4uadE+gtL3knv5Ivg9BzIefcxy343C8='
// Algorand signData domain-separation prefix the backend expects.
const SIGN_PREFIX = 'MX'

describe('buildBackupRegisterMessage', () => {
    test('joins the five fields with the REGISTER prefix and pipes', () => {
        const message = buildBackupRegisterMessage({
            backupId: BACKUP_ID,
            deviceId: 'device-123',
            nonce: '1700000000000.abc',
            publicKey: PUBLIC_KEY,
        })

        expect(message).toBe(
            `REGISTER|${BACKUP_ID}|device-123|1700000000000.abc|${PUBLIC_KEY}`,
        )
    })
})

describe('buildBackupRegisterProof', () => {
    test('produces a nonce of the form <timestamp>.<base64>', () => {
        const { nonce } = buildBackupRegisterProof({
            backupId: BACKUP_ID,
            deviceId: 'device-123',
            publicKey: PUBLIC_KEY,
            authSecretKey: KEYPAIR.secretKey,
        })

        expect(nonce).toMatch(/^\d+\.[A-Za-z0-9+/]+=*$/)
    })

    test('signs the "MX"-prefixed payload so the signature verifies', () => {
        const { nonce, signature } = buildBackupRegisterProof({
            backupId: BACKUP_ID,
            deviceId: 'device-123',
            publicKey: PUBLIC_KEY,
            authSecretKey: KEYPAIR.secretKey,
        })

        const signedBytes = new TextEncoder().encode(
            SIGN_PREFIX +
                buildBackupRegisterMessage({
                    backupId: BACKUP_ID,
                    deviceId: 'device-123',
                    nonce,
                    publicKey: PUBLIC_KEY,
                }),
        )

        expect(
            nacl.sign.detached.verify(
                signedBytes,
                decodeFromBase64(signature),
                KEYPAIR.publicKey,
            ),
        ).toBe(true)
    })
})
