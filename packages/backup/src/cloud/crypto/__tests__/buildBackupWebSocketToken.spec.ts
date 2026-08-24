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

import { describe, expect, it } from 'vitest'
import nacl from 'tweetnacl'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    buildBackupWebSocketMessage,
    buildBackupWebSocketToken,
} from '../buildBackupWebSocketToken'

describe('buildBackupWebSocketToken', () => {
    it('builds the canonical WS message string', () => {
        expect(
            buildBackupWebSocketMessage(
                'did:pera:ABC',
                'dev-1',
                '2026-06-25T00:00:00.000Z',
            ),
        ).toBe('WS|did:pera:ABC|dev-1|2026-06-25T00:00:00.000Z')
    })

    it('produces a base64 Ed25519 signature the matching public key verifies', () => {
        const kp = nacl.sign.keyPair()
        const token = buildBackupWebSocketToken({
            backupId: 'did:pera:ABC',
            deviceId: 'dev-1',
            timestamp: '2026-06-25T00:00:00.000Z',
            authSecretKey: kp.secretKey,
        })
        const message = new TextEncoder().encode(
            'WS|did:pera:ABC|dev-1|2026-06-25T00:00:00.000Z',
        )
        expect(
            nacl.sign.detached.verify(
                message,
                decodeFromBase64(token),
                kp.publicKey,
            ),
        ).toBe(true)
    })
})
