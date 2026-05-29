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

import { describe, expect, it } from 'vitest'

import { fromBase64Url } from '../base64url'
import { buildClientDataJSON } from '../clientData'

describe('buildClientDataJSON', () => {
    it('serializes keys in the type/challenge/origin/crossOrigin order', () => {
        const { json } = buildClientDataJSON({
            type: 'webauthn.get',
            challenge: new Uint8Array([1, 2, 3]),
            origin: 'https://pera.app',
        })
        expect(json).toBe(
            '{"type":"webauthn.get","challenge":"AQID","origin":"https://pera.app","crossOrigin":false}',
        )
    })

    it('base64url-encodes the challenge', () => {
        const challenge = new Uint8Array([0xfb, 0xff, 0xbf])
        const { json } = buildClientDataJSON({
            type: 'webauthn.create',
            challenge,
            origin: 'https://pera.app',
        })
        const parsed = JSON.parse(json) as { challenge: string; type: string }
        expect(parsed.type).toBe('webauthn.create')
        expect(parsed.challenge).toBe('-_-_')
        expect(Array.from(fromBase64Url(parsed.challenge))).toEqual(
            Array.from(challenge),
        )
    })

    it('encodes the JSON to UTF-8 bytes matching the string', () => {
        const { json, bytes } = buildClientDataJSON({
            type: 'webauthn.get',
            challenge: new Uint8Array([0]),
            origin: 'https://pera.app',
        })
        expect(new TextDecoder().decode(bytes)).toBe(json)
    })

    it('honours an explicit crossOrigin value', () => {
        const { json } = buildClientDataJSON({
            type: 'webauthn.get',
            challenge: new Uint8Array([0]),
            origin: 'https://pera.app',
            crossOrigin: true,
        })
        expect(JSON.parse(json).crossOrigin).toBe(true)
    })
})
