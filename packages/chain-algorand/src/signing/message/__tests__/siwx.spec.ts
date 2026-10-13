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

import { describe, expect, test } from 'vitest'
import { sha256 } from '@noble/hashes/sha2.js'
import { ARC60_SCOPE_AUTH, validateArc60AuthRequest } from '../arc60'
import { buildSiwxAuthData, toSiwxMessage } from '../siwx'
import type { Siwa } from '../siwa'

const requiredSiwa: Siwa = {
    domain: 'example.io',
    account_address: 'ADDR',
    uri: 'https://example.io/login',
    version: '1',
    chain_id: '283',
    type: 'ed25519',
}

describe('toSiwxMessage', () => {
    test('renames every key onto the chain-agnostic model', () => {
        const siwx = toSiwxMessage({
            ...requiredSiwa,
            statement: 'Sign in',
            nonce: 'n0nce',
            'issued-at': '2026-01-01T00:00:00.000Z',
            'expiration-time': '2026-01-01T00:30:00.000Z',
            'not-before': '2026-01-01T00:00:00.000Z',
            'request-id': 'req-1',
            resources: ['https://example.io/a'],
        })

        expect(siwx).toEqual({
            domain: 'example.io',
            address: 'ADDR',
            uri: 'https://example.io/login',
            version: '1',
            chainId: '283',
            statement: 'Sign in',
            nonce: 'n0nce',
            issuedAt: '2026-01-01T00:00:00.000Z',
            expirationTime: '2026-01-01T00:30:00.000Z',
            notBefore: '2026-01-01T00:00:00.000Z',
            requestId: 'req-1',
            resources: ['https://example.io/a'],
        })
    })

    test('leaves absent optionals unset so the review shows no empty rows', () => {
        const siwx = toSiwxMessage(requiredSiwa)

        expect(Object.keys(siwx).sort()).toEqual([
            'address',
            'chainId',
            'domain',
            'uri',
            'version',
        ])
    })
})

describe('buildSiwxAuthData', () => {
    const args = {
        domain: 'example.io',
        address: 'ADDR',
        uri: 'https://example.io/login',
        nonce: 'n0nce',
        now: new Date('2026-01-01T00:00:00.000Z'),
    }

    test('fills signer, domain, scope and encoding', () => {
        const { authData, metadata } = buildSiwxAuthData(args)

        expect(authData.signer).toBe('ADDR')
        expect(authData.domain).toBe('example.io')
        expect(authData.authenticatorData).toEqual(
            sha256(new TextEncoder().encode('example.io')),
        )
        expect(metadata).toEqual({
            scope: ARC60_SCOPE_AUTH,
            encoding: 'base64',
        })
    })

    test('produces a request the validator accepts', () => {
        const { authData, metadata } = buildSiwxAuthData({
            ...args,
            now: new Date(),
        })

        expect(() =>
            validateArc60AuthRequest(authData, metadata, []),
        ).not.toThrow()
    })
})
