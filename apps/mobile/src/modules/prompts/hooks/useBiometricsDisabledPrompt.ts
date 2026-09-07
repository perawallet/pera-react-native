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

import { useCallback } from 'react'
import {
    useBiometrics,
    type BiometricsDisabledReason,
} from '@perawallet/wallet-core-security'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseBiometricsDisabledPromptResult = {
    /** The app turned biometric unlock off and has not explained itself yet. */
    isDue: boolean
    reason: Nullable<BiometricsDisabledReason>
    /** Re-opts in, OS prompt included. Clears the reason either way. */
    enable: () => Promise<void>
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
        const { showToast } = useToast()

        const enable = useCallback(async (): Promise<void> => {
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
                showToast({
                    title: t('security.biometrics_disabled.unavailable_title'),
                    body: t('security.biometrics_disabled.unavailable_body'),
                    type: 'error',
                })
                return
            }

            // Declined at the OS prompt, or an unexpected failure. Both are
            // answers of a sort, and neither is worth re-offering on the next
            // unlock.
            acknowledgeBiometricsDisabled()
        }, [acknowledgeBiometricsDisabled, enableBiometrics, showToast, t])

        return {
            isDue: disabledReason !== null,
            reason: disabledReason,
            enable,
            acknowledge: acknowledgeBiometricsDisabled,
        }
    }
