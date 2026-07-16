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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    armAutoLock,
    changePassword,
    disablePasskeyUnlock,
    enablePasskeyUnlock,
    getAutoLockMinutes,
    InvalidPasswordError,
    isPasskeyUnlockEnabled,
    isPasskeyUnlockSupported,
    lockVault,
    setAutoLockMinutes,
    VaultCorruptedError,
    AUTO_LOCK_MINUTES_OPTIONS,
} from '@perawallet/wallet-extension-keystore-chrome'
import { logger } from '@perawallet/wallet-core-shared'

// null covers both "not yet checked" and "unsupported" — either way the
// passkey section doesn't render.
type PasskeyState = 'disabled' | 'enabled' | null

const MIN_NEW_PASSWORD_LENGTH = 8

type ChangePasswordValidationError = 'too_short' | 'mismatch' | null
type ChangePasswordError = 'invalid_current' | 'corrupted' | 'unexpected' | null

type UseVaultSecuritySettingsScreenResult = {
    autoLockMinutes: number | null
    autoLockOptions: readonly number[]
    selectMinutes: (minutes: number) => Promise<void>
    handleLockNow: () => Promise<void>
    passkeyState: PasskeyState
    passkeyPassword: string
    setPasskeyPassword: (value: string) => void
    handleEnablePasskey: () => Promise<void>
    handleDisablePasskey: () => Promise<void>
    isEnablingPasskey: boolean
    hasPasskeyError: boolean
    hasPasskeyEnableError: boolean
    currentPassword: string
    newPassword: string
    confirmNewPassword: string
    setCurrentPassword: (value: string) => void
    setNewPassword: (value: string) => void
    setConfirmNewPassword: (value: string) => void
    isChangingPassword: boolean
    changePasswordValidationError: ChangePasswordValidationError
    changePasswordError: ChangePasswordError
    changePasswordSuccess: boolean
    canSubmitChangePassword: boolean
    handleChangePassword: () => Promise<void>
}

export const useVaultSecuritySettingsScreen =
    (): UseVaultSecuritySettingsScreenResult => {
        const [autoLockMinutes, setMinutesState] = useState<number | null>(null)
        const [passkeyState, setPasskeyState] = useState<PasskeyState>(null)
        const [passkeyPassword, setPasskeyPassword] = useState('')
        const [isEnablingPasskey, setIsEnablingPasskey] = useState(false)
        const [hasPasskeyError, setHasPasskeyError] = useState(false)
        const [hasPasskeyEnableError, setHasPasskeyEnableError] =
            useState(false)

        // Guards against the mount-time read landing after a user has already
        // selected a value: without this, a fast radio tap that resolves
        // before getAutoLockMinutes() would get clobbered by the stale
        // initial read once it finally comes back.
        const hasUserSelectedRef = useRef(false)

        useEffect(() => {
            void getAutoLockMinutes().then(minutes => {
                if (hasUserSelectedRef.current) return
                setMinutesState(minutes)
            })
        }, [])

        useEffect(() => {
            let cancelled = false
            const check = async (): Promise<void> => {
                const supported = await isPasskeyUnlockSupported()
                if (!supported) {
                    // Leave passkeyState null — the section stays hidden.
                    return
                }
                const enabled = await isPasskeyUnlockEnabled()
                if (!cancelled) {
                    setPasskeyState(enabled ? 'enabled' : 'disabled')
                }
            }
            void check()
            return () => {
                cancelled = true
            }
        }, [])

        const selectMinutes = useCallback(
            async (minutes: number): Promise<void> => {
                await setAutoLockMinutes(minutes)
                await armAutoLock(minutes)
                // Only flip the guard once the change actually took (both
                // calls above succeeded) — a failed attempt should not block
                // a still-pending initial read from populating state.
                hasUserSelectedRef.current = true
                setMinutesState(minutes)
            },
            [],
        )

        const handleLockNow = useCallback(async (): Promise<void> => {
            await lockVault()
            // VaultGate observes the lock-state change and takes over.
        }, [])

        const handleEnablePasskey = useCallback(async (): Promise<void> => {
            if (passkeyPassword.length === 0 || isEnablingPasskey) return
            setIsEnablingPasskey(true)
            setHasPasskeyError(false)
            setHasPasskeyEnableError(false)
            try {
                await enablePasskeyUnlock(passkeyPassword)
                setPasskeyState('enabled')
                setPasskeyPassword('')
            } catch (error) {
                if (error instanceof InvalidPasswordError) {
                    setHasPasskeyError(true)
                    setPasskeyPassword('')
                } else if (
                    error instanceof DOMException &&
                    error.name === 'NotAllowedError'
                ) {
                    // User cancelled the passkey prompt — treat as silent no-op.
                } else {
                    // No key/PRF/password material here — just the error object,
                    // for observability into otherwise-silent passkey-enable failures.
                    logger.error('Enable passkey unlock failed', { error })
                    setHasPasskeyEnableError(true)
                }
            } finally {
                setIsEnablingPasskey(false)
            }
        }, [passkeyPassword, isEnablingPasskey])

        const handleDisablePasskey = useCallback(async (): Promise<void> => {
            await disablePasskeyUnlock()
            setPasskeyState('disabled')
        }, [])

        const [currentPassword, setCurrentPassword] = useState('')
        const [newPassword, setNewPassword] = useState('')
        const [confirmNewPassword, setConfirmNewPassword] = useState('')
        const [isChangingPassword, setIsChangingPassword] = useState(false)
        const [changePasswordError, setChangePasswordError] =
            useState<ChangePasswordError>(null)
        const [changePasswordSuccess, setChangePasswordSuccess] =
            useState(false)

        const changePasswordValidationError: ChangePasswordValidationError =
            newPassword.length > 0 &&
            newPassword.length < MIN_NEW_PASSWORD_LENGTH
                ? 'too_short'
                : confirmNewPassword.length > 0 &&
                    confirmNewPassword !== newPassword
                  ? 'mismatch'
                  : null

        const canSubmitChangePassword =
            currentPassword.length > 0 &&
            newPassword.length >= MIN_NEW_PASSWORD_LENGTH &&
            confirmNewPassword === newPassword &&
            !isChangingPassword

        const handleChangePassword = useCallback(async (): Promise<void> => {
            if (!canSubmitChangePassword) return
            setIsChangingPassword(true)
            setChangePasswordError(null)
            setChangePasswordSuccess(false)
            try {
                await changePassword(currentPassword, newPassword)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmNewPassword('')
                setChangePasswordSuccess(true)
            } catch (error) {
                if (error instanceof InvalidPasswordError) {
                    setChangePasswordError('invalid_current')
                    setCurrentPassword('')
                } else if (error instanceof VaultCorruptedError) {
                    setChangePasswordError('corrupted')
                } else {
                    // No key/password material here — just the error object,
                    // for observability into otherwise-silent failures.
                    logger.error('Change password failed', { error })
                    setChangePasswordError('unexpected')
                }
            } finally {
                setIsChangingPassword(false)
            }
        }, [canSubmitChangePassword, currentPassword, newPassword])

        return {
            autoLockMinutes,
            autoLockOptions: AUTO_LOCK_MINUTES_OPTIONS,
            selectMinutes,
            handleLockNow,
            passkeyState,
            passkeyPassword,
            setPasskeyPassword,
            handleEnablePasskey,
            handleDisablePasskey,
            isEnablingPasskey,
            hasPasskeyError,
            hasPasskeyEnableError,
            currentPassword,
            newPassword,
            confirmNewPassword,
            setCurrentPassword,
            setNewPassword,
            setConfirmNewPassword,
            isChangingPassword,
            changePasswordValidationError,
            changePasswordError,
            changePasswordSuccess,
            canSubmitChangePassword,
            handleChangePassword,
        }
    }
