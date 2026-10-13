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
import { logger } from '@perawallet/wallet-core-shared'
import { clearAccountsStore, useDeleteAllData } from '@hooks/useDeleteAllData'

export type UseForgotPasswordViewResult = {
    isAcknowledged: boolean
    isResetting: boolean
    hasError: boolean
    toggleAcknowledged: () => void
    handleReset: () => Promise<void>
}

export type UseForgotPasswordViewParams = {
    onVaultReset: () => Promise<void>
}

export const useForgotPasswordView = ({
    onVaultReset,
}: UseForgotPasswordViewParams): UseForgotPasswordViewResult => {
    const { wipeAllUserData } = useDeleteAllData()
    const [isAcknowledged, setIsAcknowledged] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [hasError, setHasError] = useState(false)

    const toggleAcknowledged = useCallback(() => {
        setIsAcknowledged(value => !value)
    }, [])

    const handleReset = useCallback(async () => {
        if (!isAcknowledged || isResetting) return
        setIsResetting(true)
        setHasError(false)
        try {
            await wipeAllUserData()
            // The wipe keeps the accounts store for the settings flow's success
            // modal; there is none here, so drop it as the native lockout does.
            clearAccountsStore()
            // The vault was already locked, so destroying it changes no lock
            // state and fires no event; VaultGate has to be told to re-read it.
            await onVaultReset()
        } catch (error) {
            logger.error('Forgot-password reset failed', { error })
            setHasError(true)
            setIsResetting(false)
        }
    }, [isAcknowledged, isResetting, wipeAllUserData, onVaultReset])

    return {
        isAcknowledged,
        isResetting,
        hasError,
        toggleAcknowledged,
        handleReset,
    }
}
