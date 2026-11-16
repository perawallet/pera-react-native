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
    AutoDrawDelegationRejectedError,
    AutoDrawProgramUnverifiedError,
    AutoDrawTealUnverifiedError,
    CardAccountLinkedElsewhereError,
    CardCreateInProgressError,
    CardCreateUnavailableError,
    CardEscrowNotConfiguredError,
    CardOwnershipProofRejectedError,
    CardSetupIncompleteError,
    describeCardChainError,
    getCardApiError,
    type CardApiError,
} from '@perawallet/wallet-core-card'
import {
    type ChainScope,
    i18nKey,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    isConnectivityError,
    isPeraNetworkError,
    type Maybe,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCardScope } from './useCardScope'

export type CardErrorToastKeys = {
    /** i18n key for the toast title. */
    titleKey?: I18nKey
    /** i18n key for the body shown when the error carries no message. */
    bodyKey?: I18nKey
    /**
     * Whether the backend's own message may be shown as the body. Defaults to
     * true (most card errors are short, actionable Baanx validation strings).
     * Set false on flows whose failures are raw chain/infra errors: algod
     * simulate dumps and `[network:server] 503 ...` are unreadable, so those
     * surface `bodyKey` and log the detail instead.
     */
    shouldUseBackendMessage?: boolean
}

export type CardErrorCopy = {
    titleKey: I18nKey
    bodyKey: I18nKey
    bodyValues?: Record<string, string>
}

// Enough of Baanx's correlation id for support to match the logged call; the
// whole UUID is too long to read off a toast.
const REFERENCE_LENGTH = 8

// Stock server texts that tell the user nothing; any other message Baanx sends
// with a 5xx is its own explanation and is shown as is.
const GENERIC_SERVER_MESSAGES = new Set([
    'internal server error',
    'internal error',
    'server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
    'gateway time-out',
    'something went wrong',
    'an error occurred',
    'an unexpected error occurred',
    'unexpected error',
    'unknown error',
    'error',
])

const isGenericServerMessage = (message: Optional<string>): boolean => {
    if (!message) return true
    const normalized = message
        .trim()
        .toLowerCase()
        .replace(/[.!]+$/, '')
    return (
        GENERIC_SERVER_MESSAGES.has(normalized) ||
        normalized.startsWith('request failed with status code')
    )
}

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
    scope: ChainScope,
    apiError?: CardApiError,
): Maybe<CardErrorCopy> => {
    if (error instanceof UserRejectedSigningError) return null
    if (isTimeoutError(error)) {
        return {
            titleKey: i18nKey('errors.network.timeout.title'),
            bodyKey: i18nKey('errors.network.timeout.body'),
        }
    }
    if (error instanceof CardAccountLinkedElsewhereError) {
        return {
            titleKey: i18nKey(
                'peraCard.setup_status.linked_elsewhere_error_title',
            ),
            bodyKey: i18nKey(
                'peraCard.setup_status.linked_elsewhere_error_body',
            ),
        }
    }
    if (error instanceof CardCreateInProgressError) {
        return {
            titleKey: i18nKey('peraCard.setup_status.create_in_progress_title'),
            bodyKey: i18nKey('peraCard.setup_status.create_in_progress_body'),
        }
    }
    if (error instanceof CardSetupIncompleteError) {
        return {
            titleKey: i18nKey(
                'peraCard.setup_status.setup_incomplete_error_title',
            ),
            bodyKey: i18nKey(
                'peraCard.setup_status.setup_incomplete_error_body',
            ),
        }
    }
    if (error instanceof CardOwnershipProofRejectedError) {
        return {
            titleKey: i18nKey(
                'peraCard.setup_status.create_card_account_error_title',
            ),
            bodyKey: i18nKey(
                'peraCard.setup_status.create_card_account_error_body',
            ),
        }
    }
    if (error instanceof CardCreateUnavailableError) {
        return {
            titleKey: i18nKey(
                'peraCard.setup_status.create_card_unavailable_title',
            ),
            bodyKey: i18nKey(
                'peraCard.setup_status.create_card_unavailable_body',
            ),
        }
    }
    if (
        error instanceof CardEscrowNotConfiguredError ||
        error instanceof AutoDrawProgramUnverifiedError ||
        error instanceof AutoDrawTealUnverifiedError ||
        error instanceof AutoDrawDelegationRejectedError
    ) {
        return {
            titleKey: i18nKey(
                'peraCard.account.auto_funding_unavailable_title',
            ),
            bodyKey: i18nKey('peraCard.account.auto_funding_unavailable_body'),
        }
    }
    if (apiError?.code === 'CARD_OWNERSHIP_MISMATCH') {
        return {
            titleKey: i18nKey(
                'peraCard.account.auto_funding_unavailable_title',
            ),
            bodyKey: i18nKey('peraCard.account.auto_funding_unavailable_body'),
        }
    }
    if (apiError?.code === 'SIGNATURE_VERIFICATION_FAILED') {
        return {
            titleKey: i18nKey('peraCard.account.auto_funding_rejected_title'),
            bodyKey: i18nKey('peraCard.account.auto_funding_rejected_body'),
        }
    }
    // Every card chain call is paid by the linked account, whose spendable
    // native balance is easily exhausted once it holds several assets. The
    // chain names that case precisely; anything else it says is a raw dump
    // the caller's own copy covers better.
    if (
        describeCardChainError(error, scope) === 'insufficient-native-balance'
    ) {
        return {
            titleKey: i18nKey('peraCard.account.insufficient_algo_title'),
            bodyKey: i18nKey('peraCard.account.insufficient_algo_body'),
        }
    }
    if (
        apiError?.status !== undefined &&
        apiError.status >= 500 &&
        isGenericServerMessage(apiError.message)
    ) {
        const reference = apiError.correlationId?.slice(0, REFERENCE_LENGTH)
        return reference
            ? {
                  titleKey: i18nKey('peraCard.service_unavailable.title'),
                  bodyKey: i18nKey(
                      'peraCard.service_unavailable.body_with_reference',
                  ),
                  bodyValues: { reference },
              }
            : {
                  titleKey: i18nKey('peraCard.service_unavailable.title'),
                  bodyKey: i18nKey('peraCard.service_unavailable.body'),
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
    titleKey = i18nKey('peraCard.account.error_title'),
    bodyKey = i18nKey('peraCard.account.error_body'),
    shouldUseBackendMessage = true,
}: CardErrorToastKeys = {}): ((
    error: unknown,
    resolvedApiError?: CardApiError,
) => Promise<void>) => {
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const scope = useCardScope()

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
            const copy = resolveCardErrorCopy(error, scope, apiError)
            if (copy === null) return
            if (copy) {
                errorToast(t(copy.titleKey), t(copy.bodyKey, copy.bodyValues))
                return
            }
            if (!shouldUseBackendMessage) {
                errorToast(t(titleKey), t(bodyKey))
                return
            }
            errorToast(t(titleKey), apiError.message ?? t(bodyKey))
        },
        [errorToast, t, scope, titleKey, bodyKey, shouldUseBackendMessage],
    )
}
