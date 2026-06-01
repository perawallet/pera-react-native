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

import { useCallback, useEffect, useState } from 'react'
import type { BiometricSecurityLevel } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { logger } from '@perawallet/wallet-core-shared'

/**
 * Reads the strongest enrolled authentication level from the platform
 * biometrics service. Imperative form for non-render call sites (e.g. the
 * deeplink dispatcher). Falls back to `'none'` if the service is unavailable
 * so callers can treat "can't confirm" the same as "not strong".
 */
export const getBiometricSecurityLevel =
    async (): Promise<BiometricSecurityLevel> => {
        try {
            return await getProvider().biometrics.getSecurityLevel()
        } catch (error) {
            logger.warn('getBiometricSecurityLevel failed', { error })
            return 'none'
        }
    }

/**
 * True when the device satisfies the passkey provider's `strongOrCredential`
 * policy: a strong biometric, OR a device credential (PIN / pattern / password).
 * A `'weak'` biometric also qualifies — Android requires a device credential to
 * enrol any biometric, so those devices authenticate via the credential path at
 * the OS prompt. Only `'none'` (no screen lock at all) fails.
 */
export const hasStrongBiometricOrCredential = (
    level: BiometricSecurityLevel,
): boolean => level !== 'none'

export type UseBiometricSecurityLevelResult = {
    securityLevel: BiometricSecurityLevel
    /** True until the first read resolves. */
    isLoading: boolean
    /** Convenience flag: a class-3 biometric (fingerprint / 3D face) is enrolled. */
    hasStrongBiometric: boolean
    /**
     * Convenience flag: a strong biometric OR a device credential is available —
     * the passkey provider's `strongOrCredential` policy. See
     * {@link hasStrongBiometricOrCredential}.
     */
    hasStrongBiometricOrCredential: boolean
    refresh: () => void
}

/**
 * Reactive wrapper around {@link getBiometricSecurityLevel} for render paths.
 * Re-reads on mount and whenever `refresh` is called (e.g. when a screen
 * regains focus after the user visits system biometric settings).
 */
export const useBiometricSecurityLevel =
    (): UseBiometricSecurityLevelResult => {
        const [securityLevel, setSecurityLevel] =
            useState<BiometricSecurityLevel>('strong')
        const [isLoading, setIsLoading] = useState(true)

        const refresh = useCallback(() => {
            let cancelled = false
            setIsLoading(true)
            getBiometricSecurityLevel().then(level => {
                if (cancelled) return
                setSecurityLevel(level)
                setIsLoading(false)
            })
            return () => {
                cancelled = true
            }
        }, [])

        useEffect(() => refresh(), [refresh])

        return {
            securityLevel,
            isLoading,
            hasStrongBiometric: securityLevel === 'strong',
            hasStrongBiometricOrCredential:
                hasStrongBiometricOrCredential(securityLevel),
            refresh,
        }
    }
