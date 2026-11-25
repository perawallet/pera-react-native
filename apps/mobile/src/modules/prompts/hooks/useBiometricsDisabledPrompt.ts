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

import { useCallback, useState } from 'react'
import {
    useBiometrics,
    usePinCode,
    type BiometricsDisabledReason,
} from '@perawallet/wallet-core-security'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseBiometricsDisabledPromptResult = {
    /** The app turned biometric unlock off and has not explained itself yet. */
    isDue: boolean
    reason: Nullable<BiometricsDisabledReason>
    /** The prompt is asking for the PIN before re-opting in. */
    isVerifyingPin: boolean
    /**
     * Asks for the PIN when one is set, otherwise re-opts in straight away.
     * The prompt holds sheet presentation, so the PIN step renders inline.
     */
    enable: () => Promise<void>
    /**
     * Re-opts in, OS prompt included. A failure the user must fix outside the
     * app keeps the offer; any other outcome spends it.
     */
    handlePinVerified: () => Promise<void>
    /** Backs out of the PIN step; the offer stays. */
    cancelPinVerification: () => void
    /** Declines the offer, for this drop only. */
    acknowledge: () => void
}

export const useBiometricsDisabledPrompt =
    (): UseBiometricsDisabledPromptResult => {
        const {
            disabledReason,
            acknowledgeBiometricsDisabled,
            enableBiometrics,
        } = useBiometrics()
        const { t } = useLanguage()
        const { errorToast } = useToast()
        const { checkPinEnabled } = usePinCode()
        const [isVerifyingPin, setIsVerifyingPin] = useState(false)

        const turnOn = useCallback(async (): Promise<void> => {
            const result = await enableBiometrics({
                title: t('security.biometric.enable_prompt_title'),
                cancelLabel: t('security.biometric.cancel_label'),
            })
            // A success clears the reason inside `enableBiometrics` itself.
            if (result.ok) return

            // The OS refused before showing any prompt — biometrics off at the
            // device level, Pera's own biometric permission revoked, nothing
            // strong enough enrolled, or a temporary lockout ('unconfirmed').
            // The user has to leave the app to fix it, so the offer is NOT spent:
            // say what is wrong and stay on screen so the same button works when
            // they come back.
            if (
                result.reason === 'unavailable' ||
                result.reason === 'weak-biometric' ||
                result.reason === 'unconfirmed'
            ) {
                errorToast(
                    t('security.biometrics_disabled.unavailable_title'),
                    t('security.biometrics_disabled.unavailable_body'),
                )
                return
            }

            // Declined at the OS prompt, or an unexpected failure. Both are
            // answers of a sort, and neither is worth re-offering on the next
            // unlock.
            acknowledgeBiometricsDisabled()
        }, [acknowledgeBiometricsDisabled, enableBiometrics, errorToast, t])

        // An opt-in makes biometrics stand in for the PIN, so it is never
        // granted on the strength of an unlocked app alone.
        const enable = useCallback(async (): Promise<void> => {
            if (await checkPinEnabled()) {
                setIsVerifyingPin(true)
                return
            }
            await turnOn()
        }, [checkPinEnabled, turnOn])

        const handlePinVerified = useCallback(async (): Promise<void> => {
            setIsVerifyingPin(false)
            await turnOn()
        }, [turnOn])

        const cancelPinVerification = useCallback((): void => {
            setIsVerifyingPin(false)
        }, [])

        return {
            isDue: disabledReason !== null,
            reason: disabledReason,
            isVerifyingPin,
            enable,
            handlePinVerified,
            cancelPinVerification,
            acknowledge: acknowledgeBiometricsDisabled,
        }
    }
