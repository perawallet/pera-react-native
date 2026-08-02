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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    unlockVault: vi.fn(),
    unlockWithPasskey: vi.fn(),
    isPasskeyUnlockSupported: vi.fn().mockResolvedValue(false),
    isPasskeyUnlockEnabled: vi.fn().mockResolvedValue(false),
    getLockoutRemainingSeconds: vi.fn().mockResolvedValue(0),
}))

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    unlockVault: mocks.unlockVault,
    unlockWithPasskey: mocks.unlockWithPasskey,
    isPasskeyUnlockSupported: mocks.isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled: mocks.isPasskeyUnlockEnabled,
    getLockoutRemainingSeconds: mocks.getLockoutRemainingSeconds,
    InvalidPasswordError: class InvalidPasswordError extends Error {
        constructor(message: string) {
            super(message)
            this.name = 'InvalidPasswordError'
        }
    },
    VaultCorruptedError: class VaultCorruptedError extends Error {
        constructor() {
            super('Vault data is corrupted or has an unsupported format.')
            this.name = 'VaultCorruptedError'
        }
    },
    PasskeyUnlockError: class PasskeyUnlockError extends Error {
        constructor() {
            super('Passkey unlock failed: authentication tag mismatch.')
            this.name = 'PasskeyUnlockError'
        }
    },
    VaultLockedOutError: class VaultLockedOutError extends Error {
        constructor(readonly remainingSeconds: number) {
            super('Vault unlock is temporarily locked out')
            this.name = 'VaultLockedOutError'
        }
    },
}))

import { useUnlockScreen } from '../useUnlockScreen.web'

describe('useUnlockScreen', () => {
    beforeEach(() => {
        mocks.unlockVault.mockResolvedValue(undefined)
        mocks.getLockoutRemainingSeconds.mockResolvedValue(0)
        // clearAllMocks (vitest.setup.ts) clears calls, NOT implementations —
        // without these, a `true` from the canUsePasskey tests leaks forward
        // and the auto-launch effect fires in unrelated tests.
        mocks.isPasskeyUnlockSupported.mockResolvedValue(false)
        mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
        mocks.unlockWithPasskey.mockResolvedValue(undefined)
    })

    it('sets hasError and clears password on wrong password', async () => {
        const { InvalidPasswordError } =
            await import('@perawallet/wallet-extension-keystore-chrome')
        mocks.unlockVault.mockRejectedValue(
            new InvalidPasswordError('wrong password'),
        )
        const { result } = renderHook(() => useUnlockScreen())
        act(() => result.current.setPassword('wrongpass'))
        await act(() => result.current.handleUnlock())
        expect(result.current.hasError).toBe(true)
        expect(result.current.password).toBe('')
    })

    it('clears password without error on successful unlock', async () => {
        const { result } = renderHook(() => useUnlockScreen())
        act(() => result.current.setPassword('correctpassword'))
        await act(() => result.current.handleUnlock())
        expect(result.current.hasError).toBe(false)
        expect(result.current.password).toBe('')
    })

    it('rethrows unexpected errors', async () => {
        const unexpectedError = new Error('network failure')
        mocks.unlockVault.mockRejectedValue(unexpectedError)
        const { result } = renderHook(() => useUnlockScreen())
        act(() => result.current.setPassword('somepassword'))
        await expect(act(() => result.current.handleUnlock())).rejects.toThrow(
            'network failure',
        )
        expect(result.current.hasError).toBe(false)
    })

    it('does nothing when password is empty', async () => {
        const { result } = renderHook(() => useUnlockScreen())
        await act(() => result.current.handleUnlock())
        expect(mocks.unlockVault).not.toHaveBeenCalled()
    })

    it('sets hasCorruptedVaultError and does not rethrow on VaultCorruptedError', async () => {
        const { VaultCorruptedError } =
            await import('@perawallet/wallet-extension-keystore-chrome')
        mocks.unlockVault.mockRejectedValue(new VaultCorruptedError())
        const { result } = renderHook(() => useUnlockScreen())
        act(() => result.current.setPassword('anypassword'))
        await act(() => result.current.handleUnlock())
        expect(result.current.hasCorruptedVaultError).toBe(true)
        expect(result.current.hasError).toBe(false)
    })

    describe('passkey unlock', () => {
        it('canUsePasskey is false when both supported and enabled return false', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(false)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
            const { result } = renderHook(() => useUnlockScreen())
            // Wait for the effect to resolve.
            await act(async () => {})
            expect(result.current.canUsePasskey).toBe(false)
        })

        it('canUsePasskey is false when supported but not enabled', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
            const { result } = renderHook(() => useUnlockScreen())
            await act(async () => {})
            expect(result.current.canUsePasskey).toBe(false)
        })

        it('canUsePasskey is true when both supported and enabled', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            const { result } = renderHook(() => useUnlockScreen())
            await act(async () => {})
            expect(result.current.canUsePasskey).toBe(true)
        })

        it('handlePasskeyUnlock calls unlockWithPasskey and clears error state on success', async () => {
            mocks.unlockWithPasskey.mockResolvedValue(undefined)
            const { result } = renderHook(() => useUnlockScreen())
            await act(() => result.current.handlePasskeyUnlock())
            expect(mocks.unlockWithPasskey).toHaveBeenCalledOnce()
            expect(result.current.hasError).toBe(false)
            expect(result.current.hasPasskeyError).toBe(false)
        })

        it('handlePasskeyUnlock sets hasPasskeyError (not hasError) on PasskeyUnlockError', async () => {
            const { PasskeyUnlockError } =
                await import('@perawallet/wallet-extension-keystore-chrome')
            mocks.unlockWithPasskey.mockRejectedValue(new PasskeyUnlockError())
            const { result } = renderHook(() => useUnlockScreen())
            await act(() => result.current.handlePasskeyUnlock())
            expect(result.current.hasPasskeyError).toBe(true)
            expect(result.current.hasError).toBe(false)
        })

        it('handlePasskeyUnlock routes VaultCorruptedError to hasCorruptedVaultError', async () => {
            const { VaultCorruptedError } =
                await import('@perawallet/wallet-extension-keystore-chrome')
            mocks.unlockWithPasskey.mockRejectedValue(new VaultCorruptedError())
            const { result } = renderHook(() => useUnlockScreen())
            await act(() => result.current.handlePasskeyUnlock())
            expect(result.current.hasCorruptedVaultError).toBe(true)
            expect(result.current.hasPasskeyError).toBe(false)
            expect(result.current.hasError).toBe(false)
        })

        it('handlePasskeyUnlock treats NotAllowedError as silent no-op', async () => {
            mocks.unlockWithPasskey.mockRejectedValue(
                new DOMException('User cancelled', 'NotAllowedError'),
            )
            const { result } = renderHook(() => useUnlockScreen())
            // Must not throw and must not set any error state.
            await act(() => result.current.handlePasskeyUnlock())
            expect(result.current.hasPasskeyError).toBe(false)
            expect(result.current.hasCorruptedVaultError).toBe(false)
            expect(result.current.hasError).toBe(false)
        })

        it('handlePasskeyUnlock rethrows unexpected errors', async () => {
            mocks.unlockWithPasskey.mockRejectedValue(
                new Error('unexpected network error'),
            )
            const { result } = renderHook(() => useUnlockScreen())
            await expect(
                act(() => result.current.handlePasskeyUnlock()),
            ).rejects.toThrow('unexpected network error')
            expect(result.current.hasPasskeyError).toBe(false)
            expect(result.current.hasError).toBe(false)
        })
    })

    describe('passkey auto-launch', () => {
        // Auto-launch waits on TWO independent async mount probes (the
        // supported/enabled pair and the lockout hydration) plus the effect
        // they unblock. One `act` flush settles a single promise chain; these
        // need the whole cascade, so flush repeatedly.
        const settle = async (): Promise<void> => {
            for (let i = 0; i < 4; i++) {
                await act(async () => {})
            }
        }

        it('launches the passkey challenge once when a passkey is available', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            renderHook(() => useUnlockScreen())
            await settle()
            expect(mocks.unlockWithPasskey).toHaveBeenCalledOnce()
        })

        it('does not launch when no passkey is enrolled', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
            renderHook(() => useUnlockScreen())
            await settle()
            expect(mocks.unlockWithPasskey).not.toHaveBeenCalled()
        })

        it('does not launch while locked out', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            mocks.getLockoutRemainingSeconds.mockResolvedValue(30)
            renderHook(() => useUnlockScreen())
            await settle()
            expect(mocks.unlockWithPasskey).not.toHaveBeenCalled()
        })

        it('does not relaunch on re-render', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            const { result, rerender } = renderHook(() => useUnlockScreen())
            await settle()
            act(() => result.current.setPassword('typing'))
            rerender()
            await settle()
            expect(mocks.unlockWithPasskey).toHaveBeenCalledOnce()
        })

        it('leaves the retry path available after the user cancels', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            mocks.unlockWithPasskey.mockRejectedValue(
                new DOMException('User cancelled', 'NotAllowedError'),
            )
            const { result } = renderHook(() => useUnlockScreen())
            await settle()
            expect(mocks.unlockWithPasskey).toHaveBeenCalledOnce()
            expect(result.current.canUsePasskey).toBe(true)
            expect(result.current.hasPasskeyError).toBe(false)
            expect(result.current.isSubmitting).toBe(false)
            expect(result.current.isPasskeyPending).toBe(false)
        })

        // Regression coverage for the isLockoutChecked gate: the mock harness
        // otherwise resolves the lockout probe before the passkey-support
        // probe every time (Promise.all + one await vs. a single .then), so
        // nothing ever exercises the branch where they land in the opposite
        // order — which is the order the real extension can produce, since
        // both probes are independent chrome.storage.local IPCs. Extra
        // microtask hops on the lockout probe force that inversion here.
        const settleLong = async (): Promise<void> => {
            for (let i = 0; i < 10; i++) {
                await act(async () => {})
            }
        }

        it('does not auto-launch on a stale lockoutSeconds read when the lockout probe resolves after the passkey probe', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            mocks.getLockoutRemainingSeconds.mockImplementation(async () => {
                await Promise.resolve()
                await Promise.resolve()
                await Promise.resolve()
                return 30
            })
            renderHook(() => useUnlockScreen())
            await settleLong()
            expect(mocks.unlockWithPasskey).not.toHaveBeenCalled()
        })

        // Regression coverage for the once-per-DECISION latch: a user who
        // arrives already locked out is declined at mount, and must NOT get
        // an unprompted biometric dialog 30-120 seconds later when the
        // countdown reaches zero. Against the old latch (burned only on a
        // SUCCESSFUL launch), lockoutSeconds is a live effect dependency, so
        // the effect re-evaluates on every countdown tick and fires the
        // moment lockoutSeconds hits 0.
        describe('lockout present at mount', () => {
            beforeEach(() => {
                vi.useFakeTimers()
            })

            afterEach(() => {
                vi.useRealTimers()
            })

            it('does not fire an automatic prompt once a lockout present at mount later expires', async () => {
                mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
                mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
                mocks.getLockoutRemainingSeconds.mockResolvedValue(2)
                const { result } = renderHook(() => useUnlockScreen())
                await settle()
                expect(result.current.lockoutSeconds).toBe(2)
                expect(mocks.unlockWithPasskey).not.toHaveBeenCalled()

                act(() => vi.advanceTimersByTime(1000))
                act(() => vi.advanceTimersByTime(1000))
                expect(result.current.lockoutSeconds).toBe(0)

                expect(mocks.unlockWithPasskey).not.toHaveBeenCalled()
            })
        })

        it('surfaces hasPasskeyError, without rejecting, when the auto-launch itself throws an unexpected error', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            mocks.unlockWithPasskey.mockRejectedValue(
                new Error(
                    'PRF extension not supported or not returned by the authenticator.',
                ),
            )
            const { result } = renderHook(() => useUnlockScreen())
            await settle()
            expect(mocks.unlockWithPasskey).toHaveBeenCalledOnce()
            expect(result.current.hasPasskeyError).toBe(true)
        })
    })

    describe('lockout', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('sets lockoutSeconds from VaultLockedOutError on a failed unlock', async () => {
            const { VaultLockedOutError } =
                await import('@perawallet/wallet-extension-keystore-chrome')
            mocks.unlockVault.mockRejectedValue(new VaultLockedOutError(30))
            const { result } = renderHook(() => useUnlockScreen())
            act(() => result.current.setPassword('anypassword'))
            await act(() => result.current.handleUnlock())
            expect(result.current.lockoutSeconds).toBe(30)
        })

        it('counts down lockoutSeconds every second and stops at 0', async () => {
            const { VaultLockedOutError } =
                await import('@perawallet/wallet-extension-keystore-chrome')
            mocks.unlockVault.mockRejectedValue(new VaultLockedOutError(2))
            const { result } = renderHook(() => useUnlockScreen())
            act(() => result.current.setPassword('anypassword'))
            await act(() => result.current.handleUnlock())
            expect(result.current.lockoutSeconds).toBe(2)

            act(() => vi.advanceTimersByTime(1000))
            expect(result.current.lockoutSeconds).toBe(1)

            act(() => vi.advanceTimersByTime(1000))
            expect(result.current.lockoutSeconds).toBe(0)
        })

        it('hydrates lockoutSeconds from getLockoutRemainingSeconds on mount', async () => {
            mocks.getLockoutRemainingSeconds.mockResolvedValue(15)
            const { result } = renderHook(() => useUnlockScreen())
            await act(async () => {})
            expect(result.current.lockoutSeconds).toBe(15)
        })

        it('handlePasskeyUnlock sets lockoutSeconds from VaultLockedOutError', async () => {
            const { VaultLockedOutError } =
                await import('@perawallet/wallet-extension-keystore-chrome')
            mocks.unlockWithPasskey.mockRejectedValue(
                new VaultLockedOutError(45),
            )
            const { result } = renderHook(() => useUnlockScreen())
            await act(() => result.current.handlePasskeyUnlock())
            expect(result.current.lockoutSeconds).toBe(45)
            expect(result.current.hasPasskeyError).toBe(false)
        })
    })

    describe('password fallback while a passkey challenge is pending', () => {
        it('handleUnlock still performs a password unlock while isPasskeyPending is true', async () => {
            let resolvePasskey: () => void = () => {}
            mocks.unlockWithPasskey.mockImplementation(
                () =>
                    new Promise<void>(resolve => {
                        resolvePasskey = resolve
                    }),
            )
            const { result } = renderHook(() => useUnlockScreen())

            act(() => {
                void result.current.handlePasskeyUnlock()
            })
            expect(result.current.isPasskeyPending).toBe(true)
            expect(result.current.isSubmitting).toBe(false)

            act(() => result.current.setPassword('correctpassword'))
            await act(() => result.current.handleUnlock())

            expect(mocks.unlockVault).toHaveBeenCalledWith('correctpassword')
            expect(result.current.password).toBe('')

            // Let the still-pending passkey challenge resolve so it doesn't
            // leak into other tests.
            await act(async () => {
                resolvePasskey()
            })
        })
    })
})
