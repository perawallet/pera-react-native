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

import { describe, it, expect } from 'vitest'
import { sha256 } from '@noble/hashes/sha2.js'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import {
    buildEscrowSiwaPayload,
    buildEscrowSiwaSignData,
    buildEscrowSiwaMessage,
} from '../siwa'

const args = {
    domain: 'perawallet.app',
    genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    address: 'ALGOADDRESS',
    uri: 'https://perawallet.app',
    nonce: 'nonce-123',
    now: new Date('2026-07-17T00:00:00.000Z'),
}

describe('buildEscrowSiwaPayload', () => {
    it('produces the exact key order the AB verifier expects', () => {
        const payload = buildEscrowSiwaPayload(args)

        // JSON.stringify preserves insertion order; the server re-hashes the
        // exact byte string, so this order is load-bearing.
        expect(Object.keys(payload)).toEqual([
            'domain',
            'genesis_hash',
            'account_address',
            'type',
            'statement',
            'uri',
            'version',
            'nonce',
            'issued-at',
            'expiration-time',
        ])
    })

    it('sets the fixed statement/type/version and a +30min expiry', () => {
        const payload = buildEscrowSiwaPayload(args)

        expect(payload.type).toBe('ed25519')
        expect(payload.version).toBe('1')
        expect(payload.statement).toBe('Prove address ownership')
        expect(payload.genesis_hash).toBe(args.genesisHash)
        expect(payload.account_address).toBe(args.address)
        expect(payload['issued-at']).toBe('2026-07-17T00:00:00.000Z')
        expect(payload['expiration-time']).toBe('2026-07-17T00:30:00.000Z')
    })
})

describe('buildEscrowSiwaSignData', () => {
    it('encodes data as base64(JSON) and authenticatorData as base64(sha256(domain))', () => {
        const payload = buildEscrowSiwaPayload(args)
        const signData = buildEscrowSiwaSignData(payload)

        expect(signData.data).toBe(
            encodeToBase64(new TextEncoder().encode(JSON.stringify(payload))),
        )
        expect(signData.authenticatorData).toBe(
            encodeToBase64(sha256(new TextEncoder().encode(args.domain))),
        )
        // authenticatorData[0:32] === sha256(domain) (the ARC-60 invariant).
        expect(decodeFromBase64(signData.authenticatorData)).toHaveLength(32)
    })
})

describe('buildEscrowSiwaMessage', () => {
    it('is sha256(data) || raw authenticatorData (64 bytes, authData NOT re-hashed)', () => {
        const payload = buildEscrowSiwaPayload(args)
        const signData = buildEscrowSiwaSignData(payload)
        const message = buildEscrowSiwaMessage(signData)

        const dataHash = sha256(decodeFromBase64(signData.data))
        const rawAuth = decodeFromBase64(signData.authenticatorData)

        // Independently recompute the expected 64-byte concatenation.
        const expected = new Uint8Array(dataHash.length + rawAuth.length)
        expected.set(dataHash, 0)
        expected.set(rawAuth, dataHash.length)

        expect(message).toHaveLength(64)
        expect([...message]).toEqual([...expected])
        // The last 32 bytes are the raw domain hash, not sha256(authData).
        expect([...message.slice(32)]).toEqual([...rawAuth])
        expect([...message.slice(32)]).not.toEqual([...sha256(rawAuth)])
    })
})
