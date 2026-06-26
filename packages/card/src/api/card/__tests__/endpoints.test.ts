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
// Shared is fully mocked here (ky is mocked too, so the real shared barrel
// can't load); provide the boundary helpers the transformer uses.
vi.mock('@perawallet/wallet-core-shared', () => ({
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
import { fetchCardStatus, orderCard, freezeCard } from '../endpoints'

const validCard = {
    id: 'card_1',
    holderName: 'JANE DOE',
    expiryDate: '2027/05',
    panLast4: '1234',
    status: 'ACTIVE',
    type: 'VIRTUAL',
    orderedAt: '2026-01-01T00:00:00Z',
}

describe('card endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    it('fetches and transforms the card status', async () => {
        request.mockResolvedValue({ data: validCard })

        const card = await fetchCardStatus({ network: 'mainnet' })

        expect(card?.id).toBe('card_1')
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'GET', path: '/v1/card/status' }),
        )
    })

    it('parses the real status payload without holderName/expiryDate', async () => {
        // The live /v1/card/status omits holderName/expiryDate (and includes
        // extra fields like isFreezable we don't model); it must still validate
        // so the frozen state surfaces.
        request.mockResolvedValue({
            data: {
                id: '9539550809881888677',
                panLast4: '8533',
                status: 'FROZEN',
                type: 'VIRTUAL',
                isFreezable: true,
                orderedAt: '2026-06-23T09:39:30.771Z',
            },
        })

        const card = await fetchCardStatus({ network: 'mainnet' })

        expect(card?.status).toBe('FROZEN')
        expect(card?.panLast4).toBe('8533')
    })

    it('returns null when no card exists (404)', async () => {
        request.mockRejectedValue(new HTTPError(404))

        expect(await fetchCardStatus({ network: 'mainnet' })).toBeNull()
    })

    it('returns null on a response validation error', async () => {
        request.mockResolvedValue({ data: { id: 123 } })

        expect(await fetchCardStatus({ network: 'mainnet' })).toBeNull()
    })

    it('rethrows non-404 HTTP errors', async () => {
        request.mockRejectedValue(new HTTPError(500))

        await expect(
            fetchCardStatus({ network: 'mainnet' }),
        ).rejects.toBeInstanceOf(HTTPError)
    })

    it('orders a VIRTUAL card by default', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await orderCard({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/card/order',
                data: { type: 'VIRTUAL' },
            }),
        )
    })

    it('freezes the card', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await freezeCard({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/card/freeze',
            }),
        )
    })
})
