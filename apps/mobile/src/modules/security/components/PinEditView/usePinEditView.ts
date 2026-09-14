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

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'

export type PinEntryMode = 'setup' | 'confirm' | 'verify' | 'change_old'

export type PinConfirmedResult =
    | { ok: true }
    | { ok: false; reason: 'matches-regular-pin' }

type UsePinEditViewParams = {
    mode: PinEntryMode
    onSuccess?: () => void
    /**
     * Takes over from the default `savePin(pin)` at the end of a setup→confirm
     * flow: the caller decides what the confirmed code is for, whether that is
     * persisting it elsewhere (the duress PIN) or never persisting it at all.
     * Returning `{ ok: false }` shows the standard error animation and resets
     * the flow back to `setup`.
     */
    onPinConfirmed?: (pin: string) => Promise<PinConfirmedResult>
    /**
     * Overrides the `setup` step's title. Use when the code being collected
     * is not the app PIN, so the two never read as the same thing.
     */
    title?: string
    /** Overrides the `confirm` step's title. */
    confirmTitle?: string
}

type UsePinEditViewResult = {
    title: string
    hasError: boolean
    isDisabled: boolean
    handlePinComplete: (pin: string) => void
    handleErrorAnimationComplete: () => void
}

const isVerifyMode = (mode: Nullable<PinEntryMode>): boolean =>
    mode === 'verify' || mode === 'change_old'

export const usePinEditView = ({
    mode,
    onSuccess,
    onPinConfirmed,
    title: titleOverride,
    confirmTitle,
}: UsePinEditViewParams): UsePinEditViewResult => {
    const { t } = useLanguage()
    const {
        savePin,
        verifyPin,
        handleFailedAttempt,
        resetFailedAttempts,
        isLockedOut,
    } = usePinCode()
    const { checkBiometricsEnabled, unlockWithBiometrics } = useBiometrics()
    const { showError } = useErrorToast()

    const [currentMode, setCurrentMode] = useState<PinEntryMode>(mode)
    const [storedPin, setStoredPin] = useState<string>('')
    const [hasError, setHasError] = useState(false)

    const title = useMemo(() => {
        switch (currentMode) {
            case 'setup': {
                return titleOverride ?? t('security.pin.setup_title')
            }
            case 'confirm': {
                return confirmTitle ?? t('security.pin.confirm_title')
            }
            case 'verify': {
                return t('security.pin.verify_title')
            }
            case 'change_old': {
                return t('security.pin.change_old_title')
            }
            default: {
                return ''
            }
        }
    }, [currentMode, t, titleOverride, confirmTitle])

    // Auto-prompt biometrics when entering a verification step. The user's
    // security settings drive which factor is used: if biometrics is enabled,
    // we prompt automatically; on cancel/failure, the user falls back to PIN.
    // Tracked per-mode so re-entering verify after a cancelled prompt doesn't
    // immediately re-fire, but switching from change_old → setup → ... does.
    //
    const lastPromptedModeRef = useRef<Nullable<PinEntryMode>>(null)

    // The prompt's collaborators are read through a ref so the effect depends
    // only on `currentMode`. Otherwise an unrelated re-render (e.g. the host
    // bottom sheet finishing its open animation) — which changes the inline
    // `onSuccess` identity — would run the effect cleanup mid-prompt, drop the
    // in-flight biometric success, and force the user onto the PIN pad after
    // already passing biometrics.
    const promptRef = useRef({
        checkBiometricsEnabled,
        unlockWithBiometrics,
        resetFailedAttempts,
        onSuccess,
        t,
        showError,
    })
    promptRef.current = {
        checkBiometricsEnabled,
        unlockWithBiometrics,
        resetFailedAttempts,
        onSuccess,
        t,
        showError,
    }

    useEffect(() => {
        if (!isVerifyMode(currentMode)) {
            lastPromptedModeRef.current = null
            return
        }
        if (lastPromptedModeRef.current === currentMode) return
        lastPromptedModeRef.current = currentMode

        let cancelled = false
        try {
            void (async () => {
                const enabled = await promptRef.current.checkBiometricsEnabled()
                if (cancelled || !enabled) return
                const outcome = await promptRef.current.unlockWithBiometrics({
                    title: promptRef.current.t(
                        'security.biometric.unlock_prompt_title',
                    ),
                    cancelLabel: promptRef.current.t(
                        'security.biometric.cancel_label',
                    ),
                })
                if (cancelled || outcome.kind !== 'ok') return
                void promptRef.current.resetFailedAttempts()
                setHasError(false)
                if (currentMode === 'verify') {
                    promptRef.current.onSuccess?.()
                } else if (currentMode === 'change_old') {
                    setCurrentMode('setup')
                }
            })()
        } catch (error) {
            promptRef.current.showError(error)
        }
        return () => {
            cancelled = true
        }
    }, [currentMode])

    const handlePinComplete = useCallback(
        async (pin: string) => {
            switch (currentMode) {
                case 'setup': {
                    setStoredPin(pin)
                    setHasError(false)
                    setCurrentMode('confirm')
                    break
                }
                case 'confirm': {
                    if (pin === storedPin) {
                        if (onPinConfirmed) {
                            const result = await onPinConfirmed(pin)
                            if (result.ok) {
                                setHasError(false)
                                onSuccess?.()
                            } else {
                                // Rejected by the handler — most common
                                // case is the duress PIN matching the regular
                                // PIN. Reset back to setup so the user
                                // re-enters from scratch.
                                setStoredPin('')
                                setCurrentMode('setup')
                                setHasError(true)
                            }
                        } else {
                            await savePin(pin)
                            setHasError(false)
                            onSuccess?.()
                        }
                    } else {
                        setHasError(true)
                    }
                    break
                }
                case 'change_old':
                case 'verify': {
                    const result = await verifyPin(pin)
                    if (result.kind === 'ok') {
                        void resetFailedAttempts()
                        setHasError(false)
                        if (currentMode === 'change_old') {
                            setCurrentMode('setup')
                        } else {
                            onSuccess?.()
                        }
                    } else if (result.kind === 'duress') {
                        // The user is already unlocked here (settings, view-
                        // passphrase, etc.) so wiping would be wrong; the
                        // duress branch is only honoured at the lock screen.
                        // Show the same error as a wrong PIN but do not
                        // increment the failed-attempt counter — a stray
                        // duress entry should not contribute to lockout.
                        setHasError(true)
                    } else {
                        void handleFailedAttempt()
                        setHasError(true)
                    }
                    break
                }
            }
        },
        [
            currentMode,
            storedPin,
            savePin,
            verifyPin,
            handleFailedAttempt,
            resetFailedAttempts,
            onSuccess,
            onPinConfirmed,
        ],
    )

    const handleErrorAnimationComplete = useCallback(() => {
        setHasError(false)
    }, [])

    return {
        title,
        hasError,
        isDisabled: isLockedOut,
        handlePinComplete: (pin: string) => void handlePinComplete(pin),
        handleErrorAnimationComplete,
    }
}
