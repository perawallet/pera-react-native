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

import { describe, expect, it } from 'vitest'
import type { Key } from '@algorandfoundation/keystore-core'
import {
    LOGIN_KIND,
    LOGIN_PAYLOAD_VERSION,
    decodeLoginPayload,
    encodeLoginPayload,
    isLoginKey,
    newLoginId,
} from '../login'

const secret = {
    domain: 'example.com',
    username: 'ada@example.com',
    password: 'correct horse battery staple',
    note: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
}

describe('newLoginId', () => {
    it('prefixes the id and contains no path separator', () => {
        const id = newLoginId()

        expect(id.startsWith('pera.login.')).toBe(true)
        expect(id).not.toContain('/')
    })

    it('returns a distinct id per call', () => {
        expect(newLoginId()).not.toBe(newLoginId())
    })
})

describe('isLoginKey', () => {
    it('accepts a record whose plaintext metadata marks it a login', () => {
        const key = {
            id: 'pera.login.abc',
            type: 'secret-key',
            metadata: { kind: LOGIN_KIND, v: LOGIN_PAYLOAD_VERSION },
        } as unknown as Key

        expect(isLoginKey(key)).toBe(true)
    })

    it('rejects other secret-key records sharing the keystore', () => {
        const pin = {
            id: 'pera.pinCode',
            type: 'secret-key',
        } as unknown as Key

        expect(isLoginKey(pin)).toBe(false)
    })
})

describe('login payload codec', () => {
    it('round-trips every field', () => {
        const bytes = encodeLoginPayload(secret)

        expect(decodeLoginPayload('pera.login.abc', bytes)).toEqual({
            id: 'pera.login.abc',
            ...secret,
        })
    })

    it('returns null for bytes that are not a login payload', () => {
        const bytes = new TextEncoder().encode('{"nope":true}')

        expect(decodeLoginPayload('pera.login.abc', bytes)).toBeNull()
    })

    it('returns null for a payload version it does not understand', () => {
        const bytes = new TextEncoder().encode(
            JSON.stringify({ ...secret, v: 999 }),
        )

        expect(decodeLoginPayload('pera.login.abc', bytes)).toBeNull()
    })
})
