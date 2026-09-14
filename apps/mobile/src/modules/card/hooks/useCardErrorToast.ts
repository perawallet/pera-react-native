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
    AutoDrawProgramUnverifiedError,
    CardAccountLinkedElsewhereError,
    CardCreateInProgressError,
    CardCreateUnavailableError,
    CardEscrowNotConfiguredError,
    CardOwnershipProofRejectedError,
    CardSetupIncompleteError,
    getCardApiError,
    type CardApiError,
} from '@perawallet/wallet-core-card'
import {
    isConnectivityError,
    isPeraNetworkError,
} from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type CardErrorToastKeys = {
    /** i18n key for the toast title. */
    titleKey?: string
    /** i18n key for the body shown when the error carries no message. */
    bodyKey?: string
    /**
     * Whether the backend's own message may be shown as the body. Defaults to
     * true (most card errors are short, actionable Baanx validation strings).
     * Set false on flows whose failures are raw chain/infra errors: algod
     * simulate dumps and `[network:server] 503 ...` are unreadable, so those
     * surface `bodyKey` and log the detail instead.
     */
    shouldUseBackendMessage?: boolean
}

export type CardErrorCopy = { titleKey: string; bodyKey: string }

// Direct Baanx/AB calls surface ky's TimeoutError; proxied ones arrive wrapped.
const isTimeoutError = (error: unknown): boolean =>
    (isPeraNetworkError(error) && error.kind === 'timeout') ||
    (error instanceof Error && error.name === 'TimeoutError')

/**
 * Copy for the failures the card flows can name precisely, from the typed
 * errors the card package throws and the escrow codes it forwards. `null`
 * means show nothing (the user cancelled a signing prompt); `undefined` means
 * the caller's generic keys apply.
 */
export const resolveCardErrorCopy = (
    error: unknown,
    apiError?: CardApiError,
): CardErrorCopy | null | undefined => {
    if (error instanceof UserRejectedSigningError) return null
    if (isTimeoutError(error)) {
        return {
            titleKey: 'errors.network.timeout.title',
            bodyKey: 'errors.network.timeout.body',
        }
    }
    if (error instanceof CardAccountLinkedElsewhereError) {
        return {
            titleKey: 'peraCard.setup_status.linked_elsewhere_error_title',
            bodyKey: 'peraCard.setup_status.linked_elsewhere_error_body',
        }
    }
    if (error instanceof CardCreateInProgressError) {
        return {
            titleKey: 'peraCard.setup_status.create_in_progress_title',
            bodyKey: 'peraCard.setup_status.create_in_progress_body',
        }
    }
    if (error instanceof CardSetupIncompleteError) {
        return {
            titleKey: 'peraCard.setup_status.setup_incomplete_error_title',
            bodyKey: 'peraCard.setup_status.setup_incomplete_error_body',
        }
    }
    if (error instanceof CardOwnershipProofRejectedError) {
        return {
            titleKey: 'peraCard.setup_status.create_card_account_error_title',
            bodyKey: 'peraCard.setup_status.create_card_account_error_body',
        }
    }
    if (error instanceof CardCreateUnavailableError) {
        return {
            titleKey: 'peraCard.setup_status.create_card_unavailable_title',
            bodyKey: 'peraCard.setup_status.create_card_unavailable_body',
        }
    }
    if (
        error instanceof CardEscrowNotConfiguredError ||
        error instanceof AutoDrawProgramUnverifiedError
    ) {
        return {
            titleKey: 'peraCard.account.auto_funding_unavailable_title',
            bodyKey: 'peraCard.account.auto_funding_unavailable_body',
        }
    }
    if (apiError?.code === 'CARD_OWNERSHIP_MISMATCH') {
        return {
            titleKey: 'peraCard.account.auto_funding_unavailable_title',
            bodyKey: 'peraCard.account.auto_funding_unavailable_body',
        }
    }
    if (apiError?.code === 'SIGNATURE_VERIFICATION_FAILED') {
        return {
            titleKey: 'peraCard.account.auto_funding_rejected_title',
            bodyKey: 'peraCard.account.auto_funding_rejected_body',
        }
    }
    return undefined
}

/**
 * Returns a handler that surfaces a card error as a toast: precise copy for the
 * failures `resolveCardErrorCopy` knows, otherwise the backend's message when
 * present, otherwise the caller's generic keys. Callers that already resolved
 * the error (for a branch check) pass it as the second arg to avoid re-parsing.
 */
export const useCardErrorToast = ({
    titleKey = 'peraCard.account.error_title',
    bodyKey = 'peraCard.account.error_body',
    shouldUseBackendMessage = true,
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
            const copy = resolveCardErrorCopy(error, apiError)
            if (copy === null) return
            if (copy) {
                errorToast(t(copy.titleKey), t(copy.bodyKey))
                return
            }
            if (!shouldUseBackendMessage) {
                errorToast(t(titleKey), t(bodyKey))
                return
            }
            errorToast(t(titleKey), apiError.message ?? t(bodyKey))
        },
        [errorToast, t, titleKey, bodyKey, shouldUseBackendMessage],
    )
}
