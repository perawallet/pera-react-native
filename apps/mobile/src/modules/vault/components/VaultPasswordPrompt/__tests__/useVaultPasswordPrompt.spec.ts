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

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    verifyVaultPassword: vi.fn(),
    verifyPasskey: vi.fn(),
    isPasskeyUnlockSupported: vi.fn(),
    isPasskeyUnlockEnabled: vi.fn(),
    getLockoutRemainingSeconds: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    verifyVaultPassword: mocks.verifyVaultPassword,
    verifyPasskey: mocks.verifyPasskey,
    isPasskeyUnlockSupported: mocks.isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled: mocks.isPasskeyUnlockEnabled,
    getLockoutRemainingSeconds: mocks.getLockoutRemainingSeconds,
    PasskeyUnlockError: class PasskeyUnlockError extends Error {
        constructor() {
            super('Passkey unlock failed: authentication tag mismatch.')
            this.name = 'PasskeyUnlockError'
        }
    },
    VaultCorruptedError: class VaultCorruptedError extends Error {
        constructor() {
            super('Vault data is corrupted or has an unsupported format.')
            this.name = 'VaultCorruptedError'
        }
    },
    VaultLockedOutError: class VaultLockedOutError extends Error {
        constructor(readonly remainingSeconds: number) {
            super('Vault unlock is temporarily locked out')
            this.name = 'VaultLockedOutError'
        }
    },
}))

import { useVaultPasswordPrompt } from '../useVaultPasswordPrompt.web'

describe('useVaultPasswordPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.verifyVaultPassword.mockResolvedValue(true)
        mocks.verifyPasskey.mockResolvedValue(undefined)
        mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
        mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
        mocks.getLockoutRemainingSeconds.mockResolvedValue(0)
    })

    // Safety net: if a fake-timer test above times out before its own
    // try/finally runs, this stops the leak from hanging every test after it.
    afterEach(() => {
        vi.useRealTimers()
    })

    it('auto-launches the passkey exactly once and resolves on success', async () => {
        const onVerified = vi.fn()
        renderHook(() => useVaultPasswordPrompt({ onVerified }))

        await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1))
        expect(mocks.verifyPasskey).toHaveBeenCalledTimes(1)
    })

    it('does not auto-launch when no passkey is enabled', async () => {
        mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified: vi.fn() }),
        )

        await waitFor(() => expect(result.current.canUsePasskey).toBe(false))
        expect(mocks.verifyPasskey).not.toHaveBeenCalled()
    })

    it('does not auto-launch when the client lacks PRF support', async () => {
        mocks.isPasskeyUnlockSupported.mockResolvedValue(false)
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified: vi.fn() }),
        )

        await waitFor(() => expect(result.current.canUsePasskey).toBe(false))
        expect(mocks.verifyPasskey).not.toHaveBeenCalled()
    })

    // A user who opens the sheet already locked out must not get an unprompted
    // biometric dialog when the countdown later reaches zero.
    it('does not auto-launch while locked out', async () => {
        mocks.getLockoutRemainingSeconds.mockResolvedValue(30)
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified: vi.fn() }),
        )

        await waitFor(() => expect(result.current.lockoutSeconds).toBe(30))
        expect(mocks.verifyPasskey).not.toHaveBeenCalled()
    })

    // The lockout-at-mount test above only proves the effect declines to
    // launch while lockoutSeconds > 0. It says nothing about what happens
    // once the countdown it started reaches zero on its own — which is the
    // exact case hasAutoLaunchedRef exists to cover (see the auto-launch
    // effect's comment): the latch must already be burned from the initial
    // decision, so the later zero-crossing re-render does not re-decide.
    it('does not auto-launch once a lockout counted at mount reaches zero', async () => {
        vi.useFakeTimers()
        try {
            mocks.getLockoutRemainingSeconds.mockResolvedValue(30)
            const { result } = renderHook(() =>
                useVaultPasswordPrompt({ onVerified: vi.fn() }),
            )

            // Flush the mount-time getLockoutRemainingSeconds() microtask
            // chain — waitFor's real-timer polling would hang here since
            // fake timers are active, so drive it explicitly instead.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })
            expect(result.current.lockoutSeconds).toBe(30)

            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000)
            })

            expect(result.current.lockoutSeconds).toBe(0)
            expect(mocks.verifyPasskey).not.toHaveBeenCalled()
        } finally {
            vi.useRealTimers()
        }
    })

    it('treats a cancelled prompt as a silent no-op and leaves the password usable', async () => {
        const cancelled = new DOMException('cancelled', 'NotAllowedError')
        mocks.verifyPasskey.mockRejectedValue(cancelled)
        const onVerified = vi.fn()
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified }),
        )

        await waitFor(() =>
            expect(mocks.verifyPasskey).toHaveBeenCalledTimes(1),
        )
        expect(result.current.hasPasskeyError).toBe(false)
        expect(onVerified).not.toHaveBeenCalled()

        // Password fallback still works after cancelling.
        act(() => result.current.setPassword('correct horse battery staple'))
        await act(async () => {
            await result.current.handleSubmit()
        })
        expect(onVerified).toHaveBeenCalledTimes(1)
    })

    it('surfaces a passkey failure and still allows the password', async () => {
        const { PasskeyUnlockError } =
            await import('@perawallet/wallet-extension-keystore-chrome')
        mocks.verifyPasskey.mockRejectedValue(new PasskeyUnlockError())
        const onVerified = vi.fn()
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified }),
        )

        await waitFor(() => expect(result.current.hasPasskeyError).toBe(true))
        expect(onVerified).not.toHaveBeenCalled()

        act(() => result.current.setPassword('correct horse battery staple'))
        await act(async () => {
            await result.current.handleSubmit()
        })
        expect(onVerified).toHaveBeenCalledTimes(1)
    })

    it('clears hasPasskeyError on a password submission, so only one error row renders', async () => {
        const { PasskeyUnlockError } =
            await import('@perawallet/wallet-extension-keystore-chrome')
        mocks.verifyPasskey.mockRejectedValue(new PasskeyUnlockError())
        mocks.verifyVaultPassword.mockResolvedValue(false)
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified: vi.fn() }),
        )

        await waitFor(() => expect(result.current.hasPasskeyError).toBe(true))

        act(() => result.current.setPassword('wrong-password'))
        await act(async () => {
            await result.current.handleSubmit()
        })

        expect(result.current.hasError).toBe(true)
        expect(result.current.hasPasskeyError).toBe(false)
    })

    it('seeds the countdown when the passkey reports a lockout', async () => {
        const { VaultLockedOutError } =
            await import('@perawallet/wallet-extension-keystore-chrome')
        mocks.verifyPasskey.mockRejectedValue(new VaultLockedOutError(45))
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified: vi.fn() }),
        )

        await waitFor(() => expect(result.current.lockoutSeconds).toBe(45))
    })

    // A manual "Use Passkey" tap (the next task's button) can land before the
    // support/lockout probes resolve. hasAttemptedPasskeyRef is what stops the
    // auto-launch effect from firing a second, redundant prompt once it
    // becomes eligible to decide.
    it('does not auto-launch again after a manual attempt starts before the probes resolve', async () => {
        // Only the lockout probe is held pending — isPasskeySupportChecked is
        // free to resolve immediately, same as every other test — so the
        // single gate under test is isLockoutChecked, keeping the scenario
        // isolated to one moving part.
        let resolveLockout: (value: number) => void = () => {}
        mocks.getLockoutRemainingSeconds.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveLockout = resolve
                }),
        )
        // The manual verifyPasskey() call is also held pending, so the
        // isPasskeyPending: true commit (and the effect that latches
        // hasAttemptedPasskeyRef off it) has a render to land on, rather than
        // resolving within the same microtask flush as the setState that
        // starts it — which React would otherwise coalesce away entirely.
        let resolveManualVerify: () => void = () => {}
        mocks.verifyPasskey.mockImplementation(
            () =>
                new Promise<void>(resolve => {
                    resolveManualVerify = resolve
                }),
        )

        const onVerified = vi.fn()
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified }),
        )

        // Manual attempt lands while the mount probe above is still
        // pending — handlePasskeyVerify does not gate on isLockoutChecked or
        // isPasskeySupportChecked, only the auto-launch effect does.
        let manualAttempt: Promise<void> = Promise.resolve()
        act(() => {
            manualAttempt = result.current.handlePasskeyVerify()
        })
        await waitFor(() => expect(result.current.isPasskeyPending).toBe(true))
        expect(mocks.verifyPasskey).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveManualVerify()
            await manualAttempt
        })
        expect(onVerified).toHaveBeenCalledTimes(1)

        // Now let the lockout probe resolve — the auto-launch effect becomes
        // eligible to decide for the first time.
        await act(async () => {
            resolveLockout(0)
        })

        await waitFor(() => expect(result.current.canUsePasskey).toBe(true))
        expect(mocks.verifyPasskey).toHaveBeenCalledTimes(1)
    })

    // This is the whole reason isPasskeyPending is tracked separately from
    // isSubmitting (see the hook's comments): a hung authenticator must not
    // block the password fallback.
    it('keeps the password submittable while a passkey verification is outstanding and still resolves via the fallback', async () => {
        mocks.verifyPasskey.mockImplementation(
            () => new Promise<void>(() => {}),
        )
        const onVerified = vi.fn()
        const { result } = renderHook(() =>
            useVaultPasswordPrompt({ onVerified }),
        )

        await waitFor(() => expect(result.current.isPasskeyPending).toBe(true))

        act(() => result.current.setPassword('correct horse battery staple'))
        expect(result.current.canSubmit).toBe(true)

        await act(async () => {
            await result.current.handleSubmit()
        })
        expect(onVerified).toHaveBeenCalledTimes(1)
    })
})
