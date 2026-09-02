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
import { decodeFromBase64, bytesToHex } from '@perawallet/wallet-core-shared'
import { sha256 } from '@noble/hashes/sha2.js'
import {
    buildBackupRequestMessage,
    buildBackupRequestProof,
} from '../buildBackupRequestProof'

describe('buildBackupRequestMessage', () => {
    it('hashes an absent body as sha256 of the empty string', () => {
        const emptyHash = bytesToHex(sha256(new TextEncoder().encode('')))
        const message = buildBackupRequestMessage({
            method: 'GET',
            path: '/api/v3/backup/did:pera:ADDR/manifest',
            body: undefined,
            nonce: 'nonce-1',
        })
        expect(message).toBe(
            `GET|/api/v3/backup/did:pera:ADDR/manifest|${emptyHash}|nonce-1`,
        )
    })

    it('hashes the body to hex for POST', () => {
        const body = '{"keys":["accounts/ADDR"]}'
        const expectedHash = bytesToHex(sha256(new TextEncoder().encode(body)))
        const message = buildBackupRequestMessage({
            method: 'POST',
            path: '/api/v3/backup/did:pera:ADDR/items/read',
            body,
            nonce: 'nonce-2',
        })
        expect(message).toBe(
            `POST|/api/v3/backup/did:pera:ADDR/items/read|${expectedHash}|nonce-2`,
        )
    })
})

describe('buildBackupRequestProof', () => {
    const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(1))

    it('produces a verifiable Ed25519 signature over the request message', () => {
        const { nonce, signature } = buildBackupRequestProof({
            method: 'GET',
            path: '/api/v3/backup/did:pera:ADDR/manifest',
            authSecretKey: keypair.secretKey,
        })
        const message = buildBackupRequestMessage({
            method: 'GET',
            path: '/api/v3/backup/did:pera:ADDR/manifest',
            body: undefined,
            nonce,
        })
        const ok = nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            decodeFromBase64(signature),
            keypair.publicKey,
        )
        expect(ok).toBe(true)
    })

    it('produces a nonce of the form <timestamp>.<base64>', () => {
        const { nonce } = buildBackupRequestProof({
            method: 'GET',
            path: '/api/v3/backup/did:pera:ADDR/manifest',
            authSecretKey: keypair.secretKey,
        })
        expect(nonce).toMatch(/^\d+\.[A-Za-z0-9+/]+=*$/)
    })
})
