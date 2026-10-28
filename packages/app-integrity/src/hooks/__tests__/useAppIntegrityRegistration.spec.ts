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

// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mockMode = vi.hoisted(() => ({ current: 'live' }))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => mockMode.current,
}))

const registerMock = vi.fn()
vi.mock('../../services/registerAppIntegrity', () => ({
    registerAppIntegrity: (...a: unknown[]) => registerMock(...a),
}))

import { useAppIntegrityRegistration } from '../useAppIntegrityRegistration'

describe('useAppIntegrityRegistration', () => {
    beforeEach(() => {
        registerMock.mockReset().mockResolvedValue({ status: 'success' })
        mockMode.current = 'live'
    })

    it.each(['live', 'developer'])(
        'registers against the %s deployment and returns the outcome',
        async deployment => {
            mockMode.current = deployment
            const { result } = renderHook(() => useAppIntegrityRegistration())

            let outcome: unknown
            await act(async () => {
                outcome = await result.current.register()
            })

            expect(registerMock).toHaveBeenCalledWith({ deployment })
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
        const { result } = renderHook(() => useAppIntegrityRegistration())

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
