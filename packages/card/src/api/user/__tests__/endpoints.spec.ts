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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('ky', () => {
    class HTTPError extends Error {
        response: { status: number }
        constructor(status: number) {
            super('http-error')
            this.response = { status }
        }
    }
    return { HTTPError }
})
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))
// Spread the real module: the schemas under test pull runtime helpers
// (httpsUrlSchema) from it at module-eval time, so a wholesale mock breaks the
// import rather than the assertion.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    toEnumValue: (
        enumObject: Record<string, string>,
        value: unknown,
        fallback: string,
    ) =>
        typeof value === 'string' && Object.values(enumObject).includes(value)
            ? value
            : fallback,
}))

import { HTTPError } from 'ky'
import { fetchUser, fetchVerificationSession } from '../endpoints'

describe('user endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    it('fetches and maps the user', async () => {
        request.mockResolvedValue({
            data: { id: 'u1', verificationState: 'VERIFIED' },
        })

        const user = await fetchUser({ network: 'mainnet' })

        expect(user?.id).toBe('u1')
        expect(user?.verificationState).toBe('VERIFIED')
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'GET', path: '/v1/user' }),
        )
    })

    it('returns null when there is no user (404)', async () => {
        request.mockRejectedValue(new HTTPError(404))

        expect(await fetchUser({ network: 'mainnet' })).toBeNull()
    })

    it('returns null on a validation error', async () => {
        request.mockResolvedValue({ data: { id: 123 } })

        expect(await fetchUser({ network: 'mainnet' })).toBeNull()
    })

    it('rethrows non-404 HTTP errors', async () => {
        request.mockRejectedValue(new HTTPError(500))

        await expect(fetchUser({ network: 'mainnet' })).rejects.toBeInstanceOf(
            HTTPError,
        )
    })

    it('fetches the Veriff verification session via GET', async () => {
        request.mockResolvedValue({
            data: { sessionUrl: 'https://veriff/session' },
        })

        const session = await fetchVerificationSession({ network: 'mainnet' })

        expect(session.sessionUrl).toBe('https://veriff/session')
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/user/verification',
            }),
        )
    })
})
