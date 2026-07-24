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
    getCardApiError,
    type CardApiError,
} from '@perawallet/wallet-core-card'
import { isConnectivityError } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type CardErrorToastKeys = {
    /** i18n key for the toast title. */
    titleKey?: string
    /** i18n key for the body shown when the error carries no message. */
    bodyKey?: string
}

/**
 * Returns a handler that surfaces a card API error as a toast — the backend's
 * message when present, falling back to a generic body. Shared by the card
 * flows so the message-resolution logic lives in one place; screens pass their
 * own keys to keep the per-flow wording. Callers that already resolved the
 * error (for a branch check) pass it as the second arg to avoid re-parsing.
 */
export const useCardErrorToast = ({
    titleKey = 'peraCard.account.error_title',
    bodyKey = 'peraCard.account.error_body',
}: CardErrorToastKeys = {}): ((
    error: unknown,
    resolvedApiError?: CardApiError,
) => Promise<void>) => {
    const { t } = useLanguage()
    const { errorToast } = useToast()

    return useCallback(
        async (error: unknown, resolvedApiError?: CardApiError) => {
            if (isConnectivityError(error)) {
                errorToast(
                    t('errors.network.no_connection.title'),
                    t('errors.network.no_connection.body'),
                )
                return
            }
            const apiError = resolvedApiError ?? (await getCardApiError(error))
            errorToast(t(titleKey), apiError.message ?? t(bodyKey))
        },
        [errorToast, t, titleKey, bodyKey],
    )
}
