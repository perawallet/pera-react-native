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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = vi.hoisted(() => ({ isAuthenticated: true }))
const mockNavigate = vi.fn()

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardSession: () => ({ isAuthenticated: mockState.isAuthenticated }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

import { useCardSessionGuard } from '../useCardSessionGuard'

describe('useCardSessionGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.isAuthenticated = true
    })

    it('leaves an authenticated session alone', () => {
        renderHook(() => useCardSessionGuard())

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('sends the user to sign-in when the session is lost while mounted', () => {
        const { rerender } = renderHook(() => useCardSessionGuard())

        mockState.isAuthenticated = false
        rerender()

        expect(mockNavigate).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'CardSignIn',
        })
    })

    it('sends the user to sign-in when mounted without a session', () => {
        mockState.isAuthenticated = false

        renderHook(() => useCardSessionGuard())

        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'CardSignIn',
        })
    })
})
