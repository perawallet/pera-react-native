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

import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CardEvent } from '@analytics'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mockRequestMutateAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useRequestPasswordResetMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockRequestMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
    }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

let mockRouteParams: { email?: string } | undefined
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return { ...actual, useRoute: () => ({ params: mockRouteParams }) }
})

const mockShowError = vi.fn()
vi.mock('@modules/card/hooks', () => ({
    useCardErrorToast: () => mockShowError,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardForgotPasswordScreen } from '../useCardForgotPasswordScreen'

describe('useCardForgotPasswordScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams = undefined
    })

    it('starts invalid with an empty email and does not submit', async () => {
        const { result } = renderHook(() => useCardForgotPasswordScreen())

        expect(result.current.isValid).toBe(false)
        await act(async () => {
            result.current.handleSendCode()
        })
        expect(mockRequestMutateAsync).not.toHaveBeenCalled()
    })

    it('is valid immediately when a prefill email arrives via params', async () => {
        mockRouteParams = { email: 'typed@x.com' }
        const { result } = renderHook(() => useCardForgotPasswordScreen())

        // mode: 'onChange' validates the defaultValues on first render pass.
        await waitFor(() => expect(result.current.isValid).toBe(true))
    })

    it('requests the code and advances to the verify screen with the email', async () => {
        mockRouteParams = { email: 'typed@x.com' }
        mockRequestMutateAsync.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardForgotPasswordScreen())
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleSendCode()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.RecoverResetRequestCode,
        )
        expect(mockRequestMutateAsync).toHaveBeenCalledWith({
            email: 'typed@x.com',
        })
        expect(mockNavigate).toHaveBeenCalledWith('CardForgotPasswordVerify', {
            email: 'typed@x.com',
        })
    })

    it('shows an error toast and stays put when the request fails', async () => {
        mockRouteParams = { email: 'typed@x.com' }
        mockRequestMutateAsync.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardForgotPasswordScreen())
        await waitFor(() => expect(result.current.isValid).toBe(true))

        await act(async () => {
            result.current.handleSendCode()
        })

        expect(mockShowError).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
