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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const registerMock = vi.fn()
vi.mock('../../services/registerAppIntegrity', () => ({
    registerAppIntegrity: (...a: unknown[]) => registerMock(...a),
}))

import { useAppIntegrityRegistration } from '../useAppIntegrityRegistration'

const SCOPES = [
    { chainId: 'algorand', networkId: 'mainnet' },
    { chainId: 'ethereum', networkId: 'sepolia' },
] as const

describe('useAppIntegrityRegistration', () => {
    beforeEach(() => {
        registerMock.mockReset().mockResolvedValue({ status: 'success' })
    })

    it.each(SCOPES)(
        'registers with the given scope and returns the outcome ($chainId)',
        async scope => {
            const { result } = renderHook(() =>
                useAppIntegrityRegistration(scope),
            )

            let outcome: unknown
            await act(async () => {
                outcome = await result.current.register()
            })

            expect(registerMock).toHaveBeenCalledWith({ scope })
            expect(outcome).toEqual({ status: 'success' })
        },
    )

    it('reports isRegistering while a run is in flight and clears it on failure', async () => {
        let reject: (error: Error) => void = () => undefined
        registerMock.mockReturnValue(
            new Promise((_, rej) => {
                reject = rej
            }),
        )
        const { result } = renderHook(() =>
            useAppIntegrityRegistration(SCOPES[0]),
        )

        let pending: Promise<unknown> = Promise.resolve()
        act(() => {
            pending = result.current.register().catch(() => undefined)
        })
        expect(result.current.isRegistering).toBe(true)

        await act(async () => {
            reject(new Error('attest failed'))
            await pending
        })
        expect(result.current.isRegistering).toBe(false)
    })
})
