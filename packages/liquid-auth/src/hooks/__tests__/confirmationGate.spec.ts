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

import { describe, expect, it, vi } from 'vitest'
import { encodeFrame } from '@perawallet/wallet-extension-liquid-auth'
import { createConfirmationGate, isDiscoverRequest } from '../confirmationGate'

const flush = () => new Promise(res => setTimeout(res, 0))

describe('createConfirmationGate', () => {
    it('buffers pre-confirm frames and flushes them (with responses) on confirm', async () => {
        const send = vi.fn()
        const gate = createConfirmationGate(send)
        const route = vi.fn().mockResolvedValue('response')
        const routed = gate.gate(route)

        // Pre-confirm: the frame is buffered, route is not invoked, no response.
        await expect(routed('frame-1')).resolves.toBeNull()
        expect(route).not.toHaveBeenCalled()

        gate.markConfirmed()
        await flush()
        expect(route).toHaveBeenCalledWith('frame-1')
        expect(send).toHaveBeenCalledWith('response')
    })

    it('lets allow-listed frames through before confirmation', async () => {
        const gate = createConfirmationGate(vi.fn())
        const route = vi.fn().mockResolvedValue('r')
        const routed = gate.gate(route, raw => raw === 'allowed')

        await routed('allowed')
        expect(route).toHaveBeenCalledWith('allowed')
    })

    it('passes frames straight through once confirmed', async () => {
        const gate = createConfirmationGate(vi.fn())
        const route = vi.fn().mockResolvedValue('r')
        const routed = gate.gate(route)

        gate.markConfirmed()
        await routed('frame')
        expect(route).toHaveBeenCalledWith('frame')
        expect(gate.isConfirmed()).toBe(true)
    })

    it('caps the pre-confirm buffer so a flood cannot grow unbounded', async () => {
        const gate = createConfirmationGate(vi.fn())
        const route = vi.fn().mockResolvedValue(null)
        const routed = gate.gate(route)

        for (let i = 0; i < 100; i++) await routed(`frame-${i}`)
        gate.markConfirmed()
        await flush()
        // Only the capped number of frames are retained and flushed.
        expect(route.mock.calls.length).toBeLessThanOrEqual(32)
    })
})

describe('isDiscoverRequest', () => {
    it('is true only for an arc0027 discover request frame', () => {
        expect(
            isDiscoverRequest(
                encodeFrame({ id: 'd', reference: 'arc0027:discover:request' }),
            ),
        ).toBe(true)
        expect(
            isDiscoverRequest(
                encodeFrame({ id: 'e', reference: 'arc0027:enable:request' }),
            ),
        ).toBe(false)
        expect(isDiscoverRequest('not-a-frame')).toBe(false)
    })
})
