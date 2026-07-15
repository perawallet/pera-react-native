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

import { useCallback, useEffect, useState } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAppIntegrityRegistration,
    verifyIntegrityToken,
    useAppIntegrityStore,
    type IntegrityVerification,
} from '@perawallet/wallet-core-app-integrity'

export type UseSettingsDeveloperAppIntegrityResult = {
    status: string
    integrityToken: string | null
    expiresAt: string | null
    lastError: string | null
    appEnvironment: string
    platform: string
    isSupported: boolean
    isBusy: boolean
    verifyResult: IntegrityVerification | null
    verifyError: string | null
    onRunHandshake: () => Promise<void>
    onVerifyToken: () => Promise<void>
    onClear: () => void
}

export const useSettingsDeveloperAppIntegrity =
    (): UseSettingsDeveloperAppIntegrityResult => {
        const { network } = useNetwork()
        const { deviceInfo, appIntegrity } = getProvider()
        const { register, isRegistering } = useAppIntegrityRegistration()

        const status = useAppIntegrityStore(state => state.status)
        const integrityToken = useAppIntegrityStore(
            state => state.integrityToken,
        )
        const expiresAt = useAppIntegrityStore(state => state.expiresAt)
        const lastError = useAppIntegrityStore(state => state.lastError)
        const resetState = useAppIntegrityStore(state => state.resetState)

        const [isSupported, setIsSupported] = useState(false)
        const [isVerifying, setIsVerifying] = useState(false)
        const [verifyResult, setVerifyResult] =
            useState<IntegrityVerification | null>(null)
        const [verifyError, setVerifyError] = useState<string | null>(null)

        useEffect(() => {
            let active = true
            void appIntegrity.isSupported().then(supported => {
                if (active) setIsSupported(supported)
            })
            return () => {
                active = false
            }
        }, [appIntegrity])

        const onRunHandshake = useCallback(async () => {
            await register()
        }, [register])

        const onVerifyToken = useCallback(async () => {
            setVerifyError(null)
            setVerifyResult(null)
            const token = useAppIntegrityStore.getState().integrityToken
            if (!token) {
                setVerifyError('No stored integrity token')
                return
            }
            setIsVerifying(true)
            try {
                setVerifyResult(
                    await verifyIntegrityToken({
                        integrityToken: token,
                        network,
                    }),
                )
            } catch (error) {
                setVerifyError(
                    error instanceof Error ? error.message : String(error),
                )
            } finally {
                setIsVerifying(false)
            }
        }, [network])

        const onClear = useCallback(() => {
            setVerifyResult(null)
            setVerifyError(null)
            resetState()
        }, [resetState])

        return {
            status,
            integrityToken,
            expiresAt,
            lastError,
            appEnvironment: deviceInfo.getAppEnvironment(),
            platform: deviceInfo.getDevicePlatform(),
            isSupported,
            isBusy: isRegistering || isVerifying,
            verifyResult,
            verifyError,
            onRunHandshake,
            onVerifyToken,
            onClear,
        }
    }
