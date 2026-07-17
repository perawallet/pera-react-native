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
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    class MockInvalidPasswordError extends Error {
        constructor(message: string) {
            super(message)
            this.name = 'InvalidPasswordError'
        }
    }
    class MockVaultCorruptedError extends Error {
        constructor() {
            super('Vault data is corrupted or has an unsupported format.')
            this.name = 'VaultCorruptedError'
        }
    }
    return {
        getAutoLockMinutes: vi.fn(),
        setAutoLockMinutes: vi.fn(),
        armAutoLock: vi.fn(),
        lockVault: vi.fn(),
        changePassword: vi.fn(),
        isPasskeyUnlockSupported: vi.fn(),
        isPasskeyUnlockEnabled: vi.fn(),
        enablePasskeyUnlock: vi.fn(),
        disablePasskeyUnlock: vi.fn(),
        MockInvalidPasswordError,
        MockVaultCorruptedError,
    }
})
const { MockInvalidPasswordError, MockVaultCorruptedError } = mocks

vi.mock('@perawallet/wallet-extension-keystore-chrome', () => ({
    getAutoLockMinutes: mocks.getAutoLockMinutes,
    setAutoLockMinutes: mocks.setAutoLockMinutes,
    armAutoLock: mocks.armAutoLock,
    lockVault: mocks.lockVault,
    changePassword: mocks.changePassword,
    AUTO_LOCK_MINUTES_OPTIONS: [5, 15, 30, 60],
    isPasskeyUnlockSupported: mocks.isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled: mocks.isPasskeyUnlockEnabled,
    enablePasskeyUnlock: mocks.enablePasskeyUnlock,
    disablePasskeyUnlock: mocks.disablePasskeyUnlock,
    InvalidPasswordError: mocks.MockInvalidPasswordError,
    VaultCorruptedError: mocks.MockVaultCorruptedError,
}))

import { useVaultSecuritySettingsScreen } from '../useVaultSecuritySettingsScreen'

describe('useVaultSecuritySettingsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getAutoLockMinutes.mockResolvedValue(15)
        mocks.setAutoLockMinutes.mockResolvedValue(undefined)
        mocks.armAutoLock.mockResolvedValue(undefined)
        mocks.lockVault.mockResolvedValue(undefined)
        mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
        mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
        mocks.enablePasskeyUnlock.mockResolvedValue(undefined)
        mocks.disablePasskeyUnlock.mockResolvedValue(undefined)
        mocks.changePassword.mockResolvedValue(undefined)
    })

    it('starts with autoLockMinutes null until the persisted value resolves', async () => {
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        expect(result.current.autoLockMinutes).toBeNull()
        await act(async () => {})
        expect(result.current.autoLockMinutes).toBe(15)
    })

    it('exposes AUTO_LOCK_MINUTES_OPTIONS as autoLockOptions', async () => {
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        expect(result.current.autoLockOptions).toEqual([5, 15, 30, 60])
    })

    it('selectMinutes persists, re-arms, and updates state', async () => {
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        await act(async () => {})
        await act(() => result.current.selectMinutes(30))
        expect(mocks.setAutoLockMinutes).toHaveBeenCalledWith(30)
        expect(mocks.armAutoLock).toHaveBeenCalledWith(30)
        expect(result.current.autoLockMinutes).toBe(30)
    })

    it('selectMinutes failure keeps the prior state', async () => {
        mocks.setAutoLockMinutes.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        await act(async () => {})
        await expect(
            act(() => result.current.selectMinutes(30)),
        ).rejects.toThrow('nope')
        expect(result.current.autoLockMinutes).toBe(15)
    })

    it('selectMinutes succeeding then armAutoLock throwing keeps the prior state', async () => {
        mocks.armAutoLock.mockRejectedValue(new Error('alarm api unavailable'))
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        await act(async () => {})
        expect(result.current.autoLockMinutes).toBe(15)
        await expect(
            act(() => result.current.selectMinutes(30)),
        ).rejects.toThrow('alarm api unavailable')
        expect(mocks.setAutoLockMinutes).toHaveBeenCalledWith(30)
        expect(result.current.autoLockMinutes).toBe(15)
    })

    it('a fast selectMinutes tap is not clobbered by a late-resolving initial read', async () => {
        let resolveInitial: (value: number) => void = () => {}
        mocks.getAutoLockMinutes.mockReturnValue(
            new Promise<number>(resolve => {
                resolveInitial = resolve
            }),
        )
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        expect(result.current.autoLockMinutes).toBeNull()

        await act(() => result.current.selectMinutes(30))
        expect(result.current.autoLockMinutes).toBe(30)

        // The slow initial read finally resolves with a now-stale value —
        // it must not clobber the user's selection.
        await act(async () => {
            resolveInitial(15)
            await Promise.resolve()
        })
        expect(result.current.autoLockMinutes).toBe(30)
    })

    it('handleLockNow calls lockVault', async () => {
        const { result } = renderHook(() => useVaultSecuritySettingsScreen())
        await act(() => result.current.handleLockNow())
        expect(mocks.lockVault).toHaveBeenCalledOnce()
    })

    describe('passkeyState', () => {
        it('resolves to null (section hidden) when isPasskeyUnlockSupported is false', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(false)
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            expect(result.current.passkeyState).toBeNull()
            await act(async () => {})
            expect(result.current.passkeyState).toBeNull()
            expect(mocks.isPasskeyUnlockEnabled).not.toHaveBeenCalled()
        })

        it('resolves to disabled when supported but not enabled', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(false)
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            expect(result.current.passkeyState).toBe('disabled')
        })

        it('resolves to enabled when supported and enabled', async () => {
            mocks.isPasskeyUnlockSupported.mockResolvedValue(true)
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            expect(result.current.passkeyState).toBe('enabled')
        })
    })

    describe('handleEnablePasskey', () => {
        it('guards an empty password and does not call enablePasskeyUnlock', async () => {
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            await act(() => result.current.handleEnablePasskey())
            expect(mocks.enablePasskeyUnlock).not.toHaveBeenCalled()
        })

        it('on success flips state to enabled and clears the password', async () => {
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            act(() => result.current.setPasskeyPassword('correct-password'))
            await act(() => result.current.handleEnablePasskey())
            expect(mocks.enablePasskeyUnlock).toHaveBeenCalledWith(
                'correct-password',
            )
            expect(result.current.passkeyState).toBe('enabled')
            expect(result.current.passkeyPassword).toBe('')
            expect(result.current.hasPasskeyError).toBe(false)
        })

        it('on InvalidPasswordError sets hasPasskeyError, clears the password, and does NOT flip state', async () => {
            mocks.enablePasskeyUnlock.mockRejectedValue(
                new MockInvalidPasswordError('nope'),
            )
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            act(() => result.current.setPasskeyPassword('wrong-password'))
            await act(() => result.current.handleEnablePasskey())
            expect(result.current.hasPasskeyError).toBe(true)
            expect(result.current.passkeyPassword).toBe('')
            expect(result.current.passkeyState).toBe('disabled')
        })

        it('on NotAllowedError (user cancels the passkey prompt) is a silent no-op', async () => {
            const notAllowedError = new DOMException(
                'cancelled',
                'NotAllowedError',
            )
            mocks.enablePasskeyUnlock.mockRejectedValue(notAllowedError)
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            act(() => result.current.setPasskeyPassword('some-password'))
            await act(() => result.current.handleEnablePasskey())
            expect(result.current.hasPasskeyError).toBe(false)
            expect(result.current.hasPasskeyEnableError).toBe(false)
            expect(result.current.passkeyState).toBe('disabled')
            expect(result.current.isEnablingPasskey).toBe(false)
        })

        it('on an unexpected error sets hasPasskeyEnableError without rethrowing', async () => {
            mocks.enablePasskeyUnlock.mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            act(() => result.current.setPasskeyPassword('some-password'))
            await act(() => result.current.handleEnablePasskey())
            expect(result.current.hasPasskeyEnableError).toBe(true)
            expect(result.current.passkeyState).toBe('disabled')
            expect(result.current.isEnablingPasskey).toBe(false)
        })
    })

    describe('handleDisablePasskey', () => {
        it('calls disablePasskeyUnlock and flips state to disabled', async () => {
            mocks.isPasskeyUnlockEnabled.mockResolvedValue(true)
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            expect(result.current.passkeyState).toBe('enabled')
            await act(() => result.current.handleDisablePasskey())
            expect(mocks.disablePasskeyUnlock).toHaveBeenCalledOnce()
            expect(result.current.passkeyState).toBe('disabled')
        })
    })

    describe('handleChangePassword', () => {
        const fillValidForm = (
            result: {
                current: ReturnType<typeof useVaultSecuritySettingsScreen>
            },
            currentPassword = 'old-password',
            newPassword = 'new-password-123',
            confirmNewPassword = 'new-password-123',
        ): void => {
            act(() => result.current.setCurrentPassword(currentPassword))
            act(() => result.current.setNewPassword(newPassword))
            act(() => result.current.setConfirmNewPassword(confirmNewPassword))
        }

        it('on success calls changePassword, clears fields, and sets changePasswordSuccess', async () => {
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            fillValidForm(result)
            await act(() => result.current.handleChangePassword())
            expect(mocks.changePassword).toHaveBeenCalledWith(
                'old-password',
                'new-password-123',
            )
            expect(result.current.currentPassword).toBe('')
            expect(result.current.newPassword).toBe('')
            expect(result.current.confirmNewPassword).toBe('')
            expect(result.current.changePasswordSuccess).toBe(true)
            expect(result.current.changePasswordError).toBeNull()
        })

        it('on InvalidPasswordError sets changePasswordError to invalid_current and clears only the current password', async () => {
            mocks.changePassword.mockRejectedValue(
                new MockInvalidPasswordError('nope'),
            )
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            fillValidForm(result)
            await act(() => result.current.handleChangePassword())
            expect(result.current.changePasswordError).toBe('invalid_current')
            expect(result.current.currentPassword).toBe('')
            expect(result.current.newPassword).toBe('new-password-123')
            expect(result.current.changePasswordSuccess).toBe(false)
        })

        it('on VaultCorruptedError sets changePasswordError to corrupted', async () => {
            mocks.changePassword.mockRejectedValue(
                new MockVaultCorruptedError(),
            )
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            fillValidForm(result)
            await act(() => result.current.handleChangePassword())
            expect(result.current.changePasswordError).toBe('corrupted')
            expect(result.current.changePasswordSuccess).toBe(false)
        })

        it('on an unexpected error sets changePasswordError to unexpected without rethrowing', async () => {
            mocks.changePassword.mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            fillValidForm(result)
            await act(() => result.current.handleChangePassword())
            expect(result.current.changePasswordError).toBe('unexpected')
            expect(result.current.changePasswordSuccess).toBe(false)
        })

        it('mismatched new/confirm password blocks submission without calling changePassword', async () => {
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            fillValidForm(
                result,
                'old-password',
                'new-password-123',
                'different-password',
            )
            expect(result.current.changePasswordValidationError).toBe(
                'mismatch',
            )
            expect(result.current.canSubmitChangePassword).toBe(false)
            await act(() => result.current.handleChangePassword())
            expect(mocks.changePassword).not.toHaveBeenCalled()
        })

        it('a new password shorter than 8 characters blocks submission', async () => {
            const { result } = renderHook(() =>
                useVaultSecuritySettingsScreen(),
            )
            await act(async () => {})
            fillValidForm(result, 'old-password', 'short', 'short')
            expect(result.current.changePasswordValidationError).toBe(
                'too_short',
            )
            expect(result.current.canSubmitChangePassword).toBe(false)
            await act(() => result.current.handleChangePassword())
            expect(mocks.changePassword).not.toHaveBeenCalled()
        })
    })
})
