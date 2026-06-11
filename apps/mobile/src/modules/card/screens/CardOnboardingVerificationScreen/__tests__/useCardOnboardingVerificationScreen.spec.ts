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

import { renderHook, act } from '@test-utils/render'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppState, Linking } from 'react-native'
import { OnboardingStep } from '@perawallet/wallet-core-card'

const mockStartMutateAsync = vi.fn()
const mockRefetch = vi.fn()
const mockSetOnboardingStep = vi.fn()
let mockUserData: { id: string; verificationState: string } | undefined

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useStartVerificationMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockStartMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardUserQuery: () => ({ data: mockUserData, refetch: mockRefetch }),
        useCardStore: Object.assign(() => undefined, {
            getState: () => ({ setOnboardingStep: mockSetOnboardingStep }),
        }),
    }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockSuccessToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import {
    useCardOnboardingVerificationScreen,
    VerificationPhase,
} from '../useCardOnboardingVerificationScreen'

const SESSION_URL = 'https://veriff.example/session'

let appStateListener: ((state: string) => void) | undefined

beforeEach(() => {
    vi.clearAllMocks()
    mockUserData = undefined
    mockStartMutateAsync.mockResolvedValue({ sessionUrl: SESSION_URL })
    vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    vi.spyOn(AppState, 'addEventListener').mockImplementation(
        (_event, listener) => {
            appStateListener = listener as (state: string) => void
            return { remove: vi.fn() } as ReturnType<
                typeof AppState.addEventListener
            >
        },
    )
})

const startVerification = async (result: {
    current: ReturnType<typeof useCardOnboardingVerificationScreen>
}) => {
    await act(async () => {
        result.current.handleStartVerification()
    })
    await waitFor(() =>
        expect(result.current.phase).toBe(VerificationPhase.InProgress),
    )
}

describe('useCardOnboardingVerificationScreen', () => {
    it('opens the Veriff session URL and enters the in-progress phase', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        expect(result.current.phase).toBe(VerificationPhase.Idle)
        await startVerification(result)

        expect(mockStartMutateAsync).toHaveBeenCalled()
        expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL)
    })

    it('completes onboarding and routes out when verification is VERIFIED', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        mockUserData = { id: 'u1', verificationState: 'VERIFIED' }
        act(() => rerender())

        await waitFor(() =>
            expect(result.current.phase).toBe(VerificationPhase.Verified),
        )
        expect(mockSetOnboardingStep).toHaveBeenCalledWith(
            OnboardingStep.Completed,
        )
        expect(mockNavigate).toHaveBeenCalledWith('PeraCardIntro')
    })

    it('moves to submitted when verification is PENDING', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        mockUserData = { id: 'u1', verificationState: 'PENDING' }
        act(() => rerender())

        await waitFor(() =>
            expect(result.current.phase).toBe(VerificationPhase.Submitted),
        )
        expect(mockSetOnboardingStep).not.toHaveBeenCalled()
    })

    it('moves to rejected when verification is REJECTED', async () => {
        const { result, rerender } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)

        mockUserData = { id: 'u1', verificationState: 'REJECTED' }
        act(() => rerender())

        await waitFor(() =>
            expect(result.current.phase).toBe(VerificationPhase.Rejected),
        )
    })

    it('enters the error phase when starting fails, then recovers on retry', async () => {
        mockStartMutateAsync.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )

        await act(async () => {
            result.current.handleStartVerification()
        })
        await waitFor(() =>
            expect(result.current.phase).toBe(VerificationPhase.Error),
        )

        // Retry uses the same handler and now succeeds.
        await startVerification(result)
        expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL)
    })

    it('refetches the user when the app returns to the foreground while polling', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingVerificationScreen(),
        )
        await startVerification(result)
        mockRefetch.mockClear()

        // background -> active is a foreground transition that forces a refetch.
        act(() => {
            appStateListener?.('background')
            appStateListener?.('active')
        })

        expect(mockRefetch).toHaveBeenCalled()
    })
})
