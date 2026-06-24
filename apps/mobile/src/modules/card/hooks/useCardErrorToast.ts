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
import { getCardApiError } from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

/**
 * Returns a handler that surfaces a card API error as a toast — the backend's
 * message when present, falling back to a generic body. Shared by the card
 * flows so the message-resolution logic lives in one place.
 */
export const useCardErrorToast = (): ((error: unknown) => Promise<void>) => {
    const { t } = useLanguage()
    const { errorToast } = useToast()

    return useCallback(
        async (error: unknown) => {
            const apiError = await getCardApiError(error)
            errorToast(
                t('peraCard.account.error_title'),
                apiError.message ?? t('peraCard.account.error_body'),
            )
        },
        [errorToast, t],
    )
}
