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

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { logger } from '@perawallet/wallet-core-shared'
import { usePasskeyAutofillService } from './usePasskeyAutofillService'

export const passkeyAutofillStatusQueryKey = [
    'passkeys',
    'autofill-status',
] as const

export type UsePasskeyAutofillStatusResult = {
    /** True while the initial status check is pending. */
    isLoading: boolean
    /** True when this app is the active system credential/autofill provider. */
    isProviderActive: boolean
    refresh: () => void
    openProviderSettings: () => Promise<boolean>
}

/**
 * Queries the system credential/autofill provider state. The result is the
 * core gate for the Settings → Passkeys disabled state.
 */
export const usePasskeyAutofillStatus = (): UsePasskeyAutofillStatusResult => {
    const service = usePasskeyAutofillService()

    const query = useQuery({
        queryKey: passkeyAutofillStatusQueryKey,
        queryFn: async (): Promise<boolean> => {
            try {
                return await service.isProviderActive()
            } catch (err) {
                // OS doesn't expose credential-provider state, the module
                // isn't fully initialised yet, or the device runs an
                // unsupported OS version — surface as "not active" so the
                // user sees the actionable disabled state.
                logger.warn('isProviderActive failed', { error: err })
                return false
            }
        },
        staleTime: 0,
    })

    const openProviderSettings = useCallback(async (): Promise<boolean> => {
        try {
            return await service.openProviderSettings()
        } catch (err) {
            logger.warn('openProviderSettings failed', { error: err })
            return false
        }
    }, [service])

    return {
        isLoading: query.isLoading,
        isProviderActive: query.data === true,
        refresh: query.refetch,
        openProviderSettings,
    }
}
