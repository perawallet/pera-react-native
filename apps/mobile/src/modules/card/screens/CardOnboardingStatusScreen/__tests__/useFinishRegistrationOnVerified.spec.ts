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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    LOGIN_ATTEMPT_SPACING_MS,
    MAX_LOGIN_ATTEMPTS,
    useCardStore,
    type FinalizeRegistrationOutcome,
} from '@perawallet/wallet-core-card'

// Stands in for the real mutation, including its bookkeeping: every login it
// runs is recorded against the budget, and a sign-in outcome drops the password.
let mockOutcome: FinalizeRegistrationOutcome = 'not-ready'
const mockFinalize = vi.fn(
    async ({ isAutomatic }: { email: string; isAutomatic: boolean }) => {
        useCardStore
            .getState()
            .recordLoginAttempt({ isAutomatic, at: Date.now() })
        if (mockOutcome === 'locked') useCardStore.getState().markLoginLocked()
        if (
            mockOutcome === 'otp-required' ||
            mockOutcome === 'password-required'
        ) {
            useCardStore.getState().setPassword(null)
        }
        return mockOutcome
    },
)
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useFinalizeRegistrationMutation: () => ({
        mutateAsync: mockFinalize,
        isPending: false,
    }),
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockInfoToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ infoToast: mockInfoToast }),
}))

vi.mock('@hooks/useLanguage')

let mockIsFocused = true
vi.mock('@react-navigation/native', async () => ({
    ...(await vi.importActual<object>('@react-navigation/native')),
    useIsFocused: () => mockIsFocused,
}))

import {
    FINISH_REGISTRATION_SLOW_AFTER_MS,
    useFinishRegistrationOnVerified,
    type UseFinishRegistrationOnVerifiedParams,
} from '../useFinishRegistrationOnVerified'

const SCOPE: ChainScope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' }
const VERIFIED: UseFinishRegistrationOnVerifiedParams = {
    verificationState: 'VERIFIED',
    areDetailsSubmitted: true,
    isRegistrationComplete: false,
    isAuthenticated: false,
    email: 'john@example.com',
    hasAccountSignal: false,
}

const renderFinish = (params: UseFinishRegistrationOnVerifiedParams) =>
    renderHook(
        (props: UseFinishRegistrationOnVerifiedParams) =>
            useFinishRegistrationOnVerified(SCOPE, props),
        { initialProps: params },
    )

// Lets the finalize promise and the state it touches settle.
const flush = () =>
    act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
    })

const advance = async (ms: number) => {
    await act(async () => {
        vi.advanceTimersByTime(ms)
    })
    await flush()
}

describe('useFinishRegistrationOnVerified', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mockIsFocused = true
        mockOutcome = 'not-ready'
        useCardStore.getState().resetState()
        useCardStore.getState().setPassword('Correct-Horse-1234')
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('makes exactly one automatic login when KYC verifies', async () => {
        const { rerender } = renderFinish(VERIFIED)
        await flush()
        rerender(VERIFIED)
        await flush()

        expect(mockFinalize).toHaveBeenCalledTimes(1)
        expect(mockFinalize).toHaveBeenCalledWith({
            email: 'john@example.com',
            isAutomatic: true,
        })
    })

    it('never logs in again while the record has not become an account, however long it takes', async () => {
        const { result } = renderFinish(VERIFIED)
        await flush()

        await advance(60 * 60_000)

        expect(mockFinalize).toHaveBeenCalledTimes(1)
        expect(result.current.accountPreparation).toBe('slow')
    })

    it('makes the second and last automatic login when the record turns into an account, respecting the spacing', async () => {
        const { rerender } = renderFinish(VERIFIED)
        await flush()

        // The record flips (phase ACCOUNT, or it now answers 404) early...
        rerender({ ...VERIFIED, hasAccountSignal: true })
        await flush()
        expect(mockFinalize).toHaveBeenCalledTimes(1)

        // ...but the second login still waits out the spacing.
        await advance(LOGIN_ATTEMPT_SPACING_MS - 1)
        expect(mockFinalize).toHaveBeenCalledTimes(1)
        await advance(1)
        expect(mockFinalize).toHaveBeenCalledTimes(2)

        await advance(60 * 60_000)
        expect(mockFinalize).toHaveBeenCalledTimes(2)
    })

    it('does not log in on arrival after a manual sign-in, and only once the account exists', async () => {
        useCardStore
            .getState()
            .recordLoginAttempt({ isAutomatic: false, at: Date.now() })
        const { rerender } = renderFinish(VERIFIED)
        await flush()
        expect(mockFinalize).not.toHaveBeenCalled()

        await advance(LOGIN_ATTEMPT_SPACING_MS * 3)
        expect(mockFinalize).not.toHaveBeenCalled()

        rerender({ ...VERIFIED, hasAccountSignal: true })
        await flush()
        expect(mockFinalize).toHaveBeenCalledTimes(1)
    })

    it('runs one login per "Try again" tap, and only outside the spacing', async () => {
        const { result } = renderFinish(VERIFIED)
        await flush()
        expect(result.current.canTryAgain).toBe(false)

        act(() => result.current.handleTryAgain())
        await flush()
        expect(mockFinalize).toHaveBeenCalledTimes(1)

        await advance(LOGIN_ATTEMPT_SPACING_MS)
        expect(result.current.canTryAgain).toBe(true)

        act(() => result.current.handleTryAgain())
        act(() => result.current.handleTryAgain())
        await flush()

        expect(mockFinalize).toHaveBeenCalledTimes(2)
        expect(mockFinalize).toHaveBeenLastCalledWith({
            email: 'john@example.com',
            isAutomatic: false,
        })
        expect(result.current.canTryAgain).toBe(false)
        // A tap is not automatic, so it leaves the automatic budget alone.
        expect(useCardStore.getState().loginAttempts.automatic).toBe(1)
    })

    it('stops logging in, tapped or not, once the session total is spent', async () => {
        const { result, rerender } = renderFinish(VERIFIED)
        await flush()
        for (let tap = 1; tap < MAX_LOGIN_ATTEMPTS; tap++) {
            await advance(LOGIN_ATTEMPT_SPACING_MS)
            act(() => result.current.handleTryAgain())
            await flush()
        }
        expect(mockFinalize).toHaveBeenCalledTimes(MAX_LOGIN_ATTEMPTS)

        await advance(LOGIN_ATTEMPT_SPACING_MS)
        rerender({ ...VERIFIED, hasAccountSignal: true })
        act(() => result.current.handleTryAgain())
        await advance(60 * 60_000)

        expect(mockFinalize).toHaveBeenCalledTimes(MAX_LOGIN_ATTEMPTS)
        expect(result.current.canTryAgain).toBe(false)
        expect(result.current.accountPreparation).toBe('stalled')
    })

    it('stops everything once Baanx says the account is locked', async () => {
        mockOutcome = 'locked'
        const { result, rerender } = renderFinish(VERIFIED)
        await flush()

        expect(result.current.isLoginLocked).toBe(true)
        expect(result.current.accountPreparation).toBe('none')
        expect(result.current.canTryAgain).toBe(false)

        rerender({ ...VERIFIED, hasAccountSignal: true })
        await advance(60 * 60_000)
        act(() => result.current.handleTryAgain())
        await flush()

        expect(mockFinalize).toHaveBeenCalledTimes(1)
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(useCardStore.getState().hasPassword).toBe(false)
    })

    it('says the account is being set up, then that it is taking longer than usual after ten minutes', async () => {
        const { result } = renderFinish(VERIFIED)
        await flush()
        expect(result.current.accountPreparation).toBe('preparing')

        await advance(FINISH_REGISTRATION_SLOW_AFTER_MS - 1000)
        expect(result.current.accountPreparation).toBe('preparing')

        await advance(1000)
        expect(result.current.accountPreparation).toBe('slow')
    })

    it.each(['otp-required', 'password-required'] as const)(
        'sends the user once to a sign-in that finishes this registration on %s',
        async outcome => {
            mockOutcome = outcome
            const { rerender } = renderFinish(VERIFIED)
            await flush()
            rerender(VERIFIED)
            await flush()

            expect(mockNavigate).toHaveBeenCalledTimes(1)
            expect(mockNavigate).toHaveBeenCalledWith('CardSignIn', {
                email: 'john@example.com',
                finishesRegistration: true,
            })
            expect(mockInfoToast).toHaveBeenCalled()
        },
    )

    it('keeps a way back to the sign-in after the user leaves it', async () => {
        mockOutcome = 'password-required'
        const { result } = renderFinish(VERIFIED)
        await flush()
        expect(mockNavigate).toHaveBeenCalledTimes(1)
        expect(result.current.accountPreparation).toBe('sign-in')
        expect(result.current.canTryAgain).toBe(false)

        act(() => result.current.handleSignIn())

        expect(mockNavigate).toHaveBeenCalledTimes(2)
        expect(mockNavigate).toHaveBeenLastCalledWith('CardSignIn', {
            email: 'john@example.com',
            finishesRegistration: true,
        })
        expect(mockInfoToast).toHaveBeenCalledTimes(1)
    })

    it('goes straight to sign in when no email is known', async () => {
        const { result } = renderFinish({ ...VERIFIED, email: null })
        await flush()

        expect(mockFinalize).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CardSignIn', {
            email: undefined,
            finishesRegistration: true,
        })
        expect(result.current.accountPreparation).toBe('sign-in')
    })

    it('waits while the checklist is not on screen', async () => {
        mockIsFocused = false
        const { rerender } = renderFinish(VERIFIED)
        await flush()
        expect(mockFinalize).not.toHaveBeenCalled()

        mockIsFocused = true
        rerender(VERIFIED)
        await flush()
        expect(mockFinalize).toHaveBeenCalledTimes(1)
    })

    it.each([
        [
            'KYC is still under review',
            { verificationState: 'PENDING' as const },
        ],
        ['a verified record still owes forms', { areDetailsSubmitted: false }],
        ['registration is complete', { isRegistrationComplete: true }],
        ['a session already exists', { isAuthenticated: true }],
    ])('does nothing while %s', async (_label, override) => {
        const { result } = renderFinish({ ...VERIFIED, ...override })
        await flush()

        expect(mockFinalize).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(result.current.accountPreparation).toBe('none')
    })
})
