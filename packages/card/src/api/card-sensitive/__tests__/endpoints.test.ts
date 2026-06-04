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
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import {
    fetchCardDetailsToken,
    fetchCardPinToken,
    createSetPinSession,
} from '../endpoints'

describe('card-sensitive endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    it('POSTs the details/token endpoint and returns the secure view', async () => {
        request.mockResolvedValue({
            data: {
                token: 'tok-1',
                imageUrl: 'https://host/details-image?token=tok-1',
            },
        })

        const view = await fetchCardDetailsToken({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/card/details/token',
            }),
        )
        expect(view).toEqual({
            token: 'tok-1',
            imageUrl: 'https://host/details-image?token=tok-1',
        })
    })

    it('POSTs the pin/token endpoint and returns the secure view', async () => {
        request.mockResolvedValue({
            data: {
                token: 'tok-2',
                imageUrl: 'https://host/pin-image?token=tok-2',
            },
        })

        const view = await fetchCardPinToken({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/card/pin/token',
            }),
        )
        expect(view.imageUrl).toContain('pin-image')
    })

    it('POSTs the set-pin/token endpoint and returns the hosted page', async () => {
        request.mockResolvedValue({
            data: {
                token: 'tok-3',
                hostedPageUrl: 'https://host/pin-direct/set?token=tok-3',
            },
        })

        const session = await createSetPinSession({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/card/set-pin/token',
            }),
        )
        expect(session.hostedPageUrl).toContain('pin-direct/set')
    })

    it('propagates errors rather than swallowing them', async () => {
        request.mockRejectedValue(new Error('boom'))

        await expect(
            fetchCardDetailsToken({ network: 'mainnet' }),
        ).rejects.toThrow('boom')
    })
})
