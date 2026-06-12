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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    ARC60_MAX_REQUEST_BYTES,
    assertArc60RequestWithinLimits,
    isArc60OriginMismatch,
    isArc60WirePayload,
    parseArc60WireRequest,
} from '../arc60-wire'
import { Arc60BadRequestError } from '../arc60-errors'

const AUTH_DATA = encodeToBase64(new Uint8Array(37).fill(7))

const validWireRequest = {
    data: 'eyJmb28iOiJiYXIifQ==',
    signer: 'SIGNER_ADDRESS',
    domain: 'arc60.io',
    authenticatorData: AUTH_DATA,
    metadata: { scope: 1, encoding: 'base64' },
}

describe('isArc60WirePayload', () => {
    it('returns true when authenticatorData is present', () => {
        expect(isArc60WirePayload(validWireRequest)).toBe(true)
    })

    it('returns true when metadata.scope is present without authenticatorData', () => {
        expect(isArc60WirePayload({ data: 'x', metadata: { scope: 1 } })).toBe(
            true,
        )
    })

    it('returns false for the legacy arbitrary-data array shape', () => {
        expect(
            isArc60WirePayload([{ signer: 'A', data: 'x', chainId: 416001 }]),
        ).toBe(false)
    })

    it('returns false when neither ARC-60 signal is present', () => {
        expect(isArc60WirePayload({ data: 'x', metadata: { url: 'a' } })).toBe(
            false,
        )
        expect(isArc60WirePayload(null)).toBe(false)
        expect(isArc60WirePayload('string')).toBe(false)
    })
})

describe('assertArc60RequestWithinLimits', () => {
    it('accepts a request within the size cap', () => {
        expect(() =>
            assertArc60RequestWithinLimits(validWireRequest),
        ).not.toThrow()
    })

    it('rejects an oversized request with Arc60BadRequestError', () => {
        const oversized = { blob: 'x'.repeat(ARC60_MAX_REQUEST_BYTES) }
        expect(() => assertArc60RequestWithinLimits(oversized)).toThrow(
            Arc60BadRequestError,
        )
    })
})

describe('parseArc60WireRequest', () => {
    it('parses a valid request and base64-decodes authenticatorData', () => {
        const { stdSigData, metadata } = parseArc60WireRequest(validWireRequest)

        expect(stdSigData.signer).toBe('SIGNER_ADDRESS')
        expect(stdSigData.domain).toBe('arc60.io')
        expect(stdSigData.authenticatorData).toBeInstanceOf(Uint8Array)
        expect(stdSigData.authenticatorData.length).toBe(37)
        expect(metadata).toEqual({ scope: 1, encoding: 'base64' })
    })

    it('throws Arc60BadRequestError when a required field is missing', () => {
        const { domain: _omit, ...noDomain } = validWireRequest
        expect(() => parseArc60WireRequest(noDomain)).toThrow(
            Arc60BadRequestError,
        )
    })

    it('throws Arc60BadRequestError when metadata.scope is the wrong type', () => {
        expect(() =>
            parseArc60WireRequest({
                ...validWireRequest,
                metadata: { scope: 'auth', encoding: 'base64' },
            }),
        ).toThrow(Arc60BadRequestError)
    })

    it('throws Arc60BadRequestError when authenticatorData exceeds the field cap', () => {
        expect(() =>
            parseArc60WireRequest({
                ...validWireRequest,
                authenticatorData: 'A'.repeat(513),
            }),
        ).toThrow(Arc60BadRequestError)
    })
})

describe('isArc60OriginMismatch', () => {
    it('returns false when no verified origin is available', () => {
        expect(isArc60OriginMismatch('arc60.io', undefined)).toBe(false)
        expect(isArc60OriginMismatch('arc60.io', '')).toBe(false)
    })

    it('returns false when the verified origin host matches the domain', () => {
        expect(
            isArc60OriginMismatch('arc60.io', 'https://arc60.io/sign-in'),
        ).toBe(false)
    })

    it('matches case-insensitively and ignores path/scheme on the origin', () => {
        expect(
            isArc60OriginMismatch('ARC60.io', 'https://arc60.io/a/b?c=d'),
        ).toBe(false)
    })

    it('matches when the domain itself carries a scheme', () => {
        expect(
            isArc60OriginMismatch('https://arc60.io', 'https://arc60.io/x'),
        ).toBe(false)
    })

    it('returns true when the origin host differs from the domain', () => {
        expect(
            isArc60OriginMismatch(
                'trusted-exchange.com',
                'https://evil.example/phish',
            ),
        ).toBe(true)
    })

    it('treats a differing port as a mismatch', () => {
        expect(
            isArc60OriginMismatch('arc60.io:8080', 'https://arc60.io/x'),
        ).toBe(true)
    })

    it('matches a bare host:port domain against the same-port origin', () => {
        expect(
            isArc60OriginMismatch('arc60.io:8080', 'https://arc60.io:8080/x'),
        ).toBe(false)
        expect(
            isArc60OriginMismatch('localhost:3000', 'http://localhost:3000'),
        ).toBe(false)
    })

    it('normalizes an explicit default port on either side', () => {
        expect(
            isArc60OriginMismatch('arc60.io:443', 'https://arc60.io/x'),
        ).toBe(false)
    })

    it('treats a domain smuggling userinfo as a mismatch', () => {
        // "trusted.com@evil.com" displays a trusted-looking string while its
        // URL host is evil.com — must warn even when served from evil.com.
        expect(
            isArc60OriginMismatch('trusted.com@evil.com', 'https://evil.com'),
        ).toBe(true)
    })
})
