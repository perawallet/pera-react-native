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
import nacl from 'tweetnacl'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { PeraWebImportError, PeraWebImportErrorReason } from '../../errors'
import type { PeraWebBackupResponse } from '../../models'
import { decryptPeraWebBackupPayload } from '../decrypt-backup-payload'

const KEY = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1))

const sealPlaintext = (plaintext: object, key: Uint8Array): string => {
    const nonce = nacl.randomBytes(24)
    // jsdom's TextEncoder produces a Uint8Array from a different realm than
    // tweetnacl's internal Uint8Array; wrap defensively (mirrors the ASB
    // fixture helper).
    const text = Uint8Array.from(
        new TextEncoder().encode(JSON.stringify(plaintext)),
    )
    const box = nacl.secretbox(text, nonce, key)
    const out = new Uint8Array(24 + box.length)
    out.set(nonce, 0)
    out.set(box, 24)
    return encodeToBase64(out)
}

const responseFor = (plaintext: object): PeraWebBackupResponse => ({
    id: 'b-1',
    type: 'transfer',
    encrypted_content: sealPlaintext(plaintext, KEY),
    creator_device: 'd-1',
})

describe('decryptPeraWebBackupPayload', () => {
    it('decrypts a bare-array payload (Android shape) into account rows', () => {
        const privateKey = encodeToBase64(new Uint8Array(32).fill(7))
        const response = responseFor([
            {
                address:
                    'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
                name: 'Web Account 1',
                accountType: 'single',
                privateKey,
                metadata: null,
            },
        ])

        const result = decryptPeraWebBackupPayload(response, KEY)
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].name).toBe('Web Account 1')
        expect(result.accounts[0].privateKey).not.toBeNull()
        expect(result.accounts[0].privateKey!.length).toBe(32)
    })

    it('decrypts an object payload with snake_case fields (legacy iOS shape)', () => {
        const response = responseFor({
            accounts: [
                {
                    address:
                        'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
                    name: 'iOS Account',
                    account_type: 'single',
                    private_key: encodeToBase64(new Uint8Array(64).fill(2)),
                },
            ],
        })

        const result = decryptPeraWebBackupPayload(response, KEY)
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].name).toBe('iOS Account')
        // 64-byte tweetnacl secret key is preserved by the parser; the
        // import hook slices it to 32. We accept both lengths upstream.
        expect(result.accounts[0].privateKey!.length).toBe(64)
    })

    it('drops malformed account rows but keeps the valid ones', () => {
        const response = responseFor([
            null,
            { not: 'an account' },
            { address: 'A', private_key: 'not-decodable' }, // bad key
            {
                address:
                    'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
                accountType: 'single',
                privateKey: encodeToBase64(new Uint8Array(32).fill(9)),
            },
        ])

        const result = decryptPeraWebBackupPayload(response, KEY)
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].address).toBe(
            'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
        )
    })

    it('reports EmptyContent when the API response is empty', () => {
        const response: PeraWebBackupResponse = {
            id: 'x',
            type: null,
            encrypted_content: null,
            creator_device: null,
        }
        try {
            decryptPeraWebBackupPayload(response, KEY)
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(PeraWebImportError)
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.EmptyContent,
            )
        }
    })

    it('reports DecryptionFailed for the wrong encryption key', () => {
        const response = responseFor({
            accounts: [
                {
                    address: 'A',
                    account_type: 'single',
                    private_key: encodeToBase64(new Uint8Array(32)),
                },
            ],
        })
        const wrong = new Uint8Array(32).fill(0xff)
        try {
            decryptPeraWebBackupPayload(response, wrong)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.DecryptionFailed,
            )
        }
    })

    it('reports MalformedPayload when the plaintext lacks any account rows', () => {
        const response = responseFor({ provider: 'no accounts here' })
        try {
            decryptPeraWebBackupPayload(response, KEY)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedPayload,
            )
        }
    })

    it('reports MalformedPayload when every account row is invalid', () => {
        const response = responseFor([null, {}, { foo: 'bar' }])
        try {
            decryptPeraWebBackupPayload(response, KEY)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedPayload,
            )
        }
    })
})
