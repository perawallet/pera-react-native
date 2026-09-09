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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AppState, type AppStateStatus } from 'react-native'
import { useLockScreen } from '../useLockScreen'
import {
    usePinCode,
    useBiometrics,
    type BiometricUnlockOutcome,
} from '@perawallet/wallet-core-security'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
}))

const { mockPerformDuressWipe } = vi.hoisted(() => ({
    mockPerformDuressWipe: vi.fn(),
}))

vi.mock('@modules/security/hooks/useDuressWipe', () => ({
    useDuressWipe: () => ({ performDuressWipe: mockPerformDuressWipe }),
}))

// Stubbed to keep `expo-sensors` (and its `__DEV__`-touching transitive deps
// from `expo-modules-core`) out of the import graph for unit tests. The
// hook's own behaviour is covered in
// `apps/mobile/src/modules/security/hooks/__tests__/useShakeToLockHandler.spec.ts`.
vi.mock('@modules/security/hooks/useShakeToLockHandler', () => ({
    useShakeToLockHandler: vi.fn(),
}))

describe('useLockScreen', () => {
    const mockVerifyPin = vi.fn()
    const mockHandleFailedAttempt = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockCheckBiometricsEnabled = vi.fn()
    const mockUnlockWithBiometrics = vi.fn()
    const mockOnUnlock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        mockCheckBiometricsEnabled.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            verifyPin: mockVerifyPin,
            handleFailedAttempt: mockHandleFailedAttempt,
            resetFailedAttempts: mockResetFailedAttempts,
            isLockedOut: false,
            lockoutEndTime: null,
            setLockoutEndTime: mockSetLockoutEndTime,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: mockCheckBiometricsEnabled,
            unlockWithBiometrics: mockUnlockWithBiometrics,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return initial state', () => {
        const { result } = renderHook(() =>
            useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
        )

        expect(result.current.hasError).toBe(false)
        expect(result.current.isLockedOut).toBe(false)
        expect(result.current.remainingSeconds).toBe(0)
        expect(result.current.isDuressWipeInProgress).toBe(false)
        expect(typeof result.current.handlePinComplete).toBe('function')
        expect(typeof result.current.handleErrorAnimationComplete).toBe(
            'function',
        )
    })

    it('should check biometrics enabled on mount', async () => {
        mockCheckBiometricsEnabled.mockResolvedValue(false)

        renderHook(() =>
            useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
        )

        await vi.waitFor(() => {
            expect(mockCheckBiometricsEnabled).toHaveBeenCalled()
        })
    })

    it('does NOT attempt biometric auth when the user is locked out', async () => {
        // Simulate the user mounting the lock screen mid-lockout. The PIN
        // exponential backoff is meaningless if biometric auth still bypasses
        // it — so the effect must short-circuit on isLockedOut.
        const lockoutEndTime = Date.now() + 60_000
        ;(usePinCode as Mock).mockReturnValue({
            verifyPin: mockVerifyPin,
            handleFailedAttempt: mockHandleFailedAttempt,
            resetFailedAttempts: mockResetFailedAttempts,
            isLockedOut: true,
            lockoutEndTime,
            setLockoutEndTime: mockSetLockoutEndTime,
        })
        mockCheckBiometricsEnabled.mockResolvedValue(true)
        mockUnlockWithBiometrics.mockResolvedValue({ kind: 'ok' })

        renderHook(() =>
            useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
        )

        // Flush microtasks; if the effect was going to call biometrics it
        // would have queued the work by now.
        await act(async () => {
            await Promise.resolve()
        })

        expect(mockCheckBiometricsEnabled).not.toHaveBeenCalled()
        expect(mockUnlockWithBiometrics).not.toHaveBeenCalled()
        expect(mockOnUnlock).not.toHaveBeenCalled()
    })

    describe('unlockWithBiometrics outcome handling', () => {
        it('unlocks only when the token unwrap succeeds', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockUnlockWithBiometrics.mockResolvedValue({ kind: 'ok' })

            renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )
            await vi.waitFor(() => expect(mockOnUnlock).toHaveBeenCalled())
        })

        it('stays locked when the unwrap reports a mismatch', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockUnlockWithBiometrics.mockResolvedValue({ kind: 'mismatch' })

            renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )
            await vi.waitFor(() =>
                expect(mockUnlockWithBiometrics).toHaveBeenCalled(),
            )
            expect(mockOnUnlock).not.toHaveBeenCalled()
        })

        it('stays locked and does not retry when the record reports a lockout', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockUnlockWithBiometrics.mockResolvedValue({
                kind: 'locked',
                lockoutEndTime: Date.now() + 30_000,
            })

            renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )
            await vi.waitFor(() =>
                expect(mockUnlockWithBiometrics).toHaveBeenCalled(),
            )
            expect(mockOnUnlock).not.toHaveBeenCalled()
            expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
        })

        it('retries once on a system cancel, as before', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockUnlockWithBiometrics
                .mockResolvedValueOnce({
                    kind: 'failed',
                    reason: 'system-cancel',
                })
                .mockResolvedValueOnce({ kind: 'ok' })

            renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )
            await vi.waitFor(() => expect(mockOnUnlock).toHaveBeenCalled())
        })

        it('feeds the record lockout into the pad when the unwrap reports locked', async () => {
            const lockoutEndTime = Date.now() + 30_000
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockUnlockWithBiometrics.mockResolvedValue({
                kind: 'locked',
                lockoutEndTime,
            })

            renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )
            await vi.waitFor(() =>
                expect(mockSetLockoutEndTime).toHaveBeenCalledWith(
                    lockoutEndTime,
                ),
            )
            expect(mockOnUnlock).not.toHaveBeenCalled()
        })
    })

    describe('handlePinComplete', () => {
        it('should call onUnlock when PIN is valid', async () => {
            mockVerifyPin.mockResolvedValue({ kind: 'ok' })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockVerifyPin).toHaveBeenCalledWith('1234')
            expect(mockResetFailedAttempts).toHaveBeenCalled()
            expect(mockOnUnlock).toHaveBeenCalled()
        })

        it('flags a duress wipe in progress while wiping, then unlocks and clears it', async () => {
            mockVerifyPin.mockResolvedValue({ kind: 'duress' })
            let resolveWipe: (() => void) | undefined
            mockPerformDuressWipe.mockReturnValue(
                new Promise<void>(resolve => {
                    resolveWipe = resolve
                }),
            )

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            await act(async () => {
                result.current.handlePinComplete('1234')
                // Let verifyPin resolve so the duress branch sets its state.
                await Promise.resolve()
                await Promise.resolve()
            })

            // Overlay should be up while the (slow) wipe runs; not yet unlocked.
            expect(result.current.isDuressWipeInProgress).toBe(true)
            expect(mockPerformDuressWipe).toHaveBeenCalledTimes(1)
            expect(mockOnUnlock).not.toHaveBeenCalled()

            await act(async () => {
                resolveWipe?.()
                // Flush the finally block (onUnlock + clear the overlay flag).
                await Promise.resolve()
                await Promise.resolve()
            })

            expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            expect(result.current.isDuressWipeInProgress).toBe(false)
        })

        it('unlocks and clears the duress flag even if the wipe throws', async () => {
            mockVerifyPin.mockResolvedValue({ kind: 'duress' })
            mockPerformDuressWipe.mockRejectedValue(new Error('boom'))

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            await act(async () => {
                // The wipe rejecting must not stop the finally block from
                // unlocking and clearing the overlay flag. handlePinComplete is
                // typed fire-and-forget; adopt its underlying promise to absorb
                // the rejection rather than leak an unhandled one.
                await Promise.resolve(
                    result.current.handlePinComplete('1234'),
                ).catch(() => {})
            })

            expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            expect(result.current.isDuressWipeInProgress).toBe(false)
        })

        it('should handle failed attempt when PIN is invalid', async () => {
            mockVerifyPin.mockResolvedValue({ kind: 'fail' })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockHandleFailedAttempt).toHaveBeenCalled()
            expect(result.current.hasError).toBe(true)
            expect(mockOnUnlock).not.toHaveBeenCalled()
        })
    })

    describe('handleErrorAnimationComplete', () => {
        it('should reset hasError to false', async () => {
            mockVerifyPin.mockResolvedValue({ kind: 'fail' })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(result.current.hasError).toBe(true)

            act(() => {
                result.current.handleErrorAnimationComplete()
            })

            expect(result.current.hasError).toBe(false)
        })
    })

    describe('lockout timer', () => {
        it('should calculate remaining seconds when locked out', () => {
            const lockoutEndTime = Date.now() + 60_000

            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
                lockoutEndTime,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            expect(result.current.isLockedOut).toBe(true)
            expect(result.current.remainingSeconds).toBe(60)
        })

        it('should update remaining seconds over time', () => {
            const lockoutEndTime = Date.now() + 60_000

            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
                lockoutEndTime,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            expect(result.current.remainingSeconds).toBe(60)

            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(result.current.remainingSeconds).toBe(59)
        })

        it('should call setLockoutEndTime when remaining reaches 0', () => {
            const lockoutEndTime = Date.now() + 1000

            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
                lockoutEndTime,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(result.current.remainingSeconds).toBe(0)
            expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
        })

        it('should reset remaining seconds when not locked out', () => {
            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: false,
                lockoutEndTime: null,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
            )

            expect(result.current.remainingSeconds).toBe(0)
        })

        describe('biometric prompt on cold-start lock activation', () => {
            it('does not prompt biometrics while unlocked', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: false }),
                )

                await act(async () => {
                    await Promise.resolve()
                })

                expect(mockCheckBiometricsEnabled).not.toHaveBeenCalled()
                expect(mockUnlockWithBiometrics).not.toHaveBeenCalled()
                expect(mockOnUnlock).not.toHaveBeenCalled()
            })

            it('prompts exactly once when the app mounts unlocked and then locks', async () => {
                // Cold start: AutoLockGuard mounts with isLocked=false, the
                // async checkPinEnabled() then flips it true. The old code
                // burned the attempt flag at mount and double-prompted on the
                // flip, cancelling the first prompt mid-flight.
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                const { rerender } = renderHook(
                    ({ isLocked }: { isLocked: boolean }) =>
                        useLockScreen({ onUnlock: mockOnUnlock, isLocked }),
                    { initialProps: { isLocked: false } },
                )

                await act(async () => {
                    await Promise.resolve()
                })

                rerender({ isLocked: true })
                await act(async () => {
                    await Promise.resolve()
                })

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(mockResetFailedAttempts).toHaveBeenCalledTimes(1)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            })

            it('honours a successful prompt even when collaborator identities change mid-flight', async () => {
                // A re-render that hands the hook fresh function identities
                // (store update, i18n change) must not cancel an in-flight
                // biometric prompt.
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                let resolveAuth:
                    | ((result: BiometricUnlockOutcome) => void)
                    | undefined
                mockUnlockWithBiometrics.mockReturnValue(
                    new Promise<BiometricUnlockOutcome>(resolve => {
                        resolveAuth = resolve
                    }),
                )
                // Fresh wrapper identities on every render.
                ;(useBiometrics as Mock).mockImplementation(() => ({
                    checkBiometricsEnabled: (
                        ...args: Parameters<typeof mockCheckBiometricsEnabled>
                    ) => mockCheckBiometricsEnabled(...args),
                    unlockWithBiometrics: (
                        ...args: Parameters<typeof mockUnlockWithBiometrics>
                    ) => mockUnlockWithBiometrics(...args),
                }))

                const { rerender } = renderHook(
                    ({ isLocked }: { isLocked: boolean }) =>
                        useLockScreen({ onUnlock: mockOnUnlock, isLocked }),
                    { initialProps: { isLocked: true } },
                )

                // Let checkBiometricsEnabled resolve so the prompt is in flight.
                await act(async () => {
                    await Promise.resolve()
                })
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)

                // Identity churn while the OS prompt is up.
                rerender({ isLocked: true })

                await act(async () => {
                    resolveAuth?.({ kind: 'ok' })
                    await Promise.resolve()
                })

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            })
        })

        describe('biometric prompt on repeated lock activations', () => {
            it('prompts biometrics again after unlock and re-lock', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                const { rerender } = renderHook(
                    ({ isLocked }: { isLocked: boolean }) =>
                        useLockScreen({ onUnlock: mockOnUnlock, isLocked }),
                    { initialProps: { isLocked: true } },
                )

                // First lock: biometrics should be called once
                await act(async () => {
                    await Promise.resolve()
                })
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)

                // Unlock
                rerender({ isLocked: false })

                // Second lock: biometrics should be called again
                rerender({ isLocked: true })
                await act(async () => {
                    await Promise.resolve()
                })
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(2)
            })

            it('does not prompt biometrics on re-lock if user is locked out', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                ;(usePinCode as Mock).mockReturnValue({
                    verifyPin: mockVerifyPin,
                    handleFailedAttempt: mockHandleFailedAttempt,
                    resetFailedAttempts: mockResetFailedAttempts,
                    isLockedOut: true,
                    lockoutEndTime: Date.now() + 60_000,
                    setLockoutEndTime: mockSetLockoutEndTime,
                })

                const { rerender } = renderHook(
                    ({ isLocked }: { isLocked: boolean }) =>
                        useLockScreen({ onUnlock: mockOnUnlock, isLocked }),
                    { initialProps: { isLocked: false } },
                )

                rerender({ isLocked: true })
                await act(async () => {
                    await Promise.resolve()
                })

                expect(mockUnlockWithBiometrics).not.toHaveBeenCalled()
            })
        })

        describe('app-active gating and system-cancel retry', () => {
            // The global react-native mock is module-level state shared across
            // tests in this file: always restore currentState in afterEach.
            const setAppState = (state: AppStateStatus) => {
                ;(AppState as { currentState: AppStateStatus }).currentState =
                    state
            }

            const getActiveWaitHandler = () =>
                (AppState.addEventListener as Mock).mock.calls.at(-1)?.[1] as (
                    next: AppStateStatus,
                ) => void

            // Retry chains span several awaits per attempt; flush generously.
            const flushPrompt = async () => {
                await act(async () => {
                    for (let i = 0; i < 15; i++) {
                        await Promise.resolve()
                    }
                })
            }

            afterEach(() => {
                setAppState('active')
            })

            it('defers the cold-start prompt until the app becomes active', async () => {
                setAppState('inactive')
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()

                expect(mockCheckBiometricsEnabled).not.toHaveBeenCalled()
                expect(mockUnlockWithBiometrics).not.toHaveBeenCalled()

                setAppState('active')
                await act(async () => {
                    getActiveWaitHandler()('active')
                })
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(mockResetFailedAttempts).toHaveBeenCalledTimes(1)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            })

            it('removes the AppState listener when unlocked before the app activates', async () => {
                setAppState('inactive')
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                const { rerender } = renderHook(
                    ({ isLocked }: { isLocked: boolean }) =>
                        useLockScreen({ onUnlock: mockOnUnlock, isLocked }),
                    { initialProps: { isLocked: true } },
                )
                await flushPrompt()
                const subscription = (
                    AppState.addEventListener as Mock
                ).mock.results.at(-1)?.value as { remove: Mock }
                const staleHandler = getActiveWaitHandler()

                rerender({ isLocked: false })

                expect(subscription.remove).toHaveBeenCalled()

                setAppState('active')
                await act(async () => {
                    staleHandler('active')
                })
                await flushPrompt()

                expect(mockUnlockWithBiometrics).not.toHaveBeenCalled()
                expect(mockOnUnlock).not.toHaveBeenCalled()
            })

            it('does not prompt on activation if a lockout began while waiting', async () => {
                setAppState('inactive')
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                const { rerender } = renderHook(
                    ({ isLocked }: { isLocked: boolean }) =>
                        useLockScreen({ onUnlock: mockOnUnlock, isLocked }),
                    { initialProps: { isLocked: true } },
                )
                await flushPrompt()

                // Failed PIN attempts on the pad trip the lockout while the
                // prompt is still waiting for activation.
                ;(usePinCode as Mock).mockReturnValue({
                    verifyPin: mockVerifyPin,
                    handleFailedAttempt: mockHandleFailedAttempt,
                    resetFailedAttempts: mockResetFailedAttempts,
                    isLockedOut: true,
                    lockoutEndTime: Date.now() + 60_000,
                    setLockoutEndTime: mockSetLockoutEndTime,
                })
                rerender({ isLocked: true })

                setAppState('active')
                await act(async () => {
                    getActiveWaitHandler()('active')
                })
                await flushPrompt()

                expect(mockCheckBiometricsEnabled).not.toHaveBeenCalled()
                expect(mockUnlockWithBiometrics).not.toHaveBeenCalled()
            })

            it('retries after a system-cancel once the app becomes active, then unlocks', async () => {
                // The deeplink cold-start repro: RN already reports 'active'
                // when the first prompt fires, but the OS cancels it because
                // the app is still mid-launch.
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                let resolveFirstAuth:
                    | ((result: BiometricUnlockOutcome) => void)
                    | undefined
                mockUnlockWithBiometrics
                    .mockReturnValueOnce(
                        new Promise<BiometricUnlockOutcome>(resolve => {
                            resolveFirstAuth = resolve
                        }),
                    )
                    .mockResolvedValueOnce({ kind: 'ok' })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)

                // The cancellation lands while the app is genuinely inactive.
                setAppState('inactive')
                await act(async () => {
                    resolveFirstAuth?.({
                        kind: 'failed',
                        reason: 'system-cancel',
                    })
                })
                await flushPrompt()
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)

                setAppState('active')
                await act(async () => {
                    getActiveWaitHandler()('active')
                })
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(2)
                expect(mockResetFailedAttempts).toHaveBeenCalledTimes(1)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            })

            it('retries immediately when the app is already active on a system-cancel', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics
                    .mockResolvedValueOnce({
                        kind: 'failed',
                        reason: 'system-cancel',
                    })
                    .mockResolvedValueOnce({ kind: 'ok' })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(2)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            })

            it('stops retrying after the retry budget is spent', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'failed',
                    reason: 'system-cancel',
                })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()

                // Initial attempt + MAX_SYSTEM_CANCEL_RETRIES.
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(3)
                expect(mockOnUnlock).not.toHaveBeenCalled()
            })

            it.each([
                'user-cancel',
                'lockout',
                'failed',
                'unavailable',
                'unknown',
            ] as const)('never retries after a %s failure', async reason => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'failed',
                    reason,
                })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                // No retry armed: nothing ever subscribed to AppState.
                expect(AppState.addEventListener).not.toHaveBeenCalled()
                expect(mockOnUnlock).not.toHaveBeenCalled()
            })

            it('never retries when the record reports a lockout', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'locked',
                    lockoutEndTime: Date.now() + 30_000,
                })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(AppState.addEventListener).not.toHaveBeenCalled()
                expect(mockOnUnlock).not.toHaveBeenCalled()
            })

            it('never retries when the unwrap reports a mismatch', async () => {
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({ kind: 'mismatch' })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(AppState.addEventListener).not.toHaveBeenCalled()
                expect(mockOnUnlock).not.toHaveBeenCalled()
            })

            it('ignores AppState churn from a prompt that already succeeded', async () => {
                setAppState('inactive')
                mockCheckBiometricsEnabled.mockResolvedValue(true)
                mockUnlockWithBiometrics.mockResolvedValue({
                    kind: 'ok',
                })

                renderHook(() =>
                    useLockScreen({ onUnlock: mockOnUnlock, isLocked: true }),
                )
                await flushPrompt()
                const handler = getActiveWaitHandler()

                setAppState('active')
                await act(async () => {
                    handler('active')
                })
                await flushPrompt()
                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)

                // iOS drives inactive -> active around the prompt itself; the
                // stale listener must not re-prompt.
                await act(async () => {
                    handler('inactive')
                    handler('active')
                })
                await flushPrompt()

                expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1)
                expect(mockOnUnlock).toHaveBeenCalledTimes(1)
            })
        })
    })
})
