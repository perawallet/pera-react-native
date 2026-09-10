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
import { useQuery } from '@tanstack/react-query'
import { logger } from '@perawallet/wallet-core-shared'
import { usePasskeyAutofillService } from './usePasskeyAutofillService'

export const autofillServiceStatusQueryKey = [
    'passkeys',
    'autofill-service-status',
] as const

export type AutofillServiceStatus = 'active' | 'inactive' | 'unsupported'

export type UseAutofillServiceStatusResult = {
    /** True while the initial status check is pending. */
    isLoading: boolean
    status: AutofillServiceStatus
    refresh: () => void
    openAutofillSettings: () => Promise<boolean>
}

/**
 * Queries the system autofill service state. Distinguishes "supported but
 * off" from "no autofill service exists on this OS" so callers don't offer
 * an enable action that leads nowhere.
 */
export const useAutofillServiceStatus = (): UseAutofillServiceStatusResult => {
    const service = usePasskeyAutofillService()

    const query = useQuery({
        queryKey: autofillServiceStatusQueryKey,
        queryFn: async (): Promise<AutofillServiceStatus> => {
            try {
                return (await service.isAutofillServiceActive())
                    ? 'active'
                    : 'inactive'
            } catch (err) {
                // Below API 26, and on iOS, there is no autofill service
                // to enable. Offering an enable action there would send
                // the user somewhere that cannot help them, so this is a
                // distinct state rather than a synonym for 'inactive'.
                logger.warn('isAutofillServiceActive failed', {
                    error: err,
                })
                return 'unsupported'
            }
        },
        staleTime: 0,
    })

    const openAutofillSettings = useCallback(async (): Promise<boolean> => {
        try {
            return await service.openAutofillSettings()
        } catch (err) {
            logger.warn('openAutofillSettings failed', { error: err })
            return false
        }
    }, [service])

    return {
        isLoading: query.isLoading,
        status: query.data ?? 'inactive',
        refresh: () => void query.refetch(),
        openAutofillSettings,
    }
}
