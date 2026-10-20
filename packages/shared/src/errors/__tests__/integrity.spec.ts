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

import { HTTPError } from 'ky'
import { describe, expect, it } from 'vitest'
import {
    IntegrityRequiredError,
    isIntegrityRequiredError,
    toIntegrityRequiredError,
} from '../integrity'
import { isPeraNetworkError } from '../network'

const refusal = (
    status: number,
    {
        data,
        headers = {},
    }: { data?: unknown; headers?: Record<string, string> } = {},
): HTTPError => {
    const request = new Request('https://api.example/v1/projects/', { headers })
    const error = new HTTPError(
        new Response(null, { status }) as never,
        request,
        {} as never,
    )
    error.data = data
    return error
}

describe('IntegrityRequiredError', () => {
    it('is an expected, retryable network failure with its own copy', () => {
        const error = new IntegrityRequiredError({
            code: 'APP_INTEGRITY_TOKEN_REQUIRED',
            status: 403,
            hadToken: false,
        })

        expect(error.metadata).toMatchObject({
            category: 'network',
            retryable: true,
            expected: true,
            titleKey: 'errors.integrity.unavailable.title',
            messageKey: 'errors.integrity.unavailable.body',
        })
        expect(isIntegrityRequiredError(error)).toBe(true)
    })

    // The change-signal traps (sync-service, chain-ethereum account-state) stop
    // asking after a PeraNetworkError 401/403 until restart; a refusal that heals
    // on the next token must never look like one.
    it('is never a PeraNetworkError', () => {
        expect(
            isPeraNetworkError(
                new IntegrityRequiredError({
                    code: null,
                    status: 401,
                    hadToken: true,
                }),
            ),
        ).toBe(false)
    })
})

describe('toIntegrityRequiredError', () => {
    it('reads a 403 with an APP_INTEGRITY_ code as an integrity refusal', () => {
        const error = toIntegrityRequiredError(
            refusal(403, {
                data: {
                    error: 'x',
                    code: 'APP_INTEGRITY_PLATFORM_NOT_ALLOWED',
                },
            }),
        )

        expect(error).toMatchObject({
            code: 'APP_INTEGRITY_PLATFORM_NOT_ALLOWED',
            status: 403,
            hadToken: false,
        })
    })

    it('reads a 401 that carried a bearer as a refused token', () => {
        const error = toIntegrityRequiredError(
            refusal(401, {
                data: { status: 401, error: 'Unauthorized' },
                headers: { Authorization: 'Bearer jwt' },
            }),
        )

        expect(error).toMatchObject({ code: null, status: 401, hadToken: true })
    })

    it('reads a 401 with no credential at all as a missing token', () => {
        const error = toIntegrityRequiredError(refusal(401))

        expect(error).toMatchObject({ status: 401, hadToken: false })
    })

    it('leaves a 401 for a keyed request to mean a bad key', () => {
        expect(
            toIntegrityRequiredError(
                refusal(401, { headers: { 'X-API-Key': 'k' } }),
            ),
        ).toBeNull()
    })

    it("leaves a keyed request's refusal its own meaning, whatever the code: native guarded routes", () => {
        expect(
            toIntegrityRequiredError(
                refusal(403, {
                    data: { code: 'APP_INTEGRITY_TOKEN_REQUIRED' },
                    headers: { 'X-API-Key': 'k' },
                }),
            ),
        ).toBeNull()
    })

    it('names the refused token by the expiry in its payload', () => {
        const payload = Buffer.from(
            JSON.stringify({
                platform: 'web',
                enr: true,
                sub: 'd',
                exp: 1_800_000_000,
            }),
        ).toString('base64url')

        const error = toIntegrityRequiredError(
            refusal(401, {
                headers: { Authorization: `Bearer h.${payload}.s` },
            }),
        )

        expect(error?.tokenExpiresAt).toBe(1_800_000_000_000)
    })

    it('leaves the token unnamed when the bearer is not a readable JWT', () => {
        const error = toIntegrityRequiredError(
            refusal(401, { headers: { Authorization: 'Bearer jwt' } }),
        )

        expect(error?.tokenExpiresAt).toBeNull()
    })

    it('leaves a 403 without an integrity code its own meaning', () => {
        expect(
            toIntegrityRequiredError(
                refusal(403, {
                    data: { type: 'PermissionDenied' },
                    headers: { Authorization: 'Bearer jwt' },
                }),
            ),
        ).toBeNull()
    })

    it('ignores every other status and anything that is not an HTTP error', () => {
        expect(
            toIntegrityRequiredError(
                refusal(500, {
                    data: { code: 'APP_INTEGRITY_TOKEN_REQUIRED' },
                }),
            ),
        ).toBeNull()
        expect(toIntegrityRequiredError(new Error('boom'))).toBeNull()
    })
})
