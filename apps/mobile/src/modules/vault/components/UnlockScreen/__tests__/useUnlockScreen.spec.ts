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

import { useUnlockScreen } from '../useUnlockScreen'

describe('useUnlockScreen', () => {
    beforeEach(() => {
        mocks.unlockVault.mockResolvedValue(undefined)
        mocks.getLockoutRemainingSeconds.mockResolvedValue(0)
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
})
