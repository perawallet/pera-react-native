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
import { AlgodError, toAlgodError } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import {
    AppError,
    getNetworkErrorMessageKeys,
    isPeraNetworkError,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    type ShowNotificationParams,
    type NotifierRoot,
} from 'react-native-notifier'
import { useToast } from './useToast'
import { useAlgodErrorMessage } from './useAlgodErrorMessage'
import { useLanguage } from './useLanguage'

type ToastOptions = ShowNotificationParams & { notifier?: NotifierRoot }

type UseErrorToastResult = {
    showError: (
        error: unknown,
        fallbackTitle?: string,
        options?: ToastOptions,
    ) => void
}

/**
 * Centralized error → toast dispatcher.
 *
 * Routes by error type so each call site stays one line:
 *   - {@link PeraNetworkError} → localized network-taxonomy copy (must be
 *                                checked before {@link AppError} since it's
 *                                a subclass)
 *   - {@link AlgodError}       → localized `errors.algod.<code>` title + body
 *   - {@link AppError}         → fallback title + the error's user-facing message
 *   - any other Error          → run through the algod parser; if recognized,
 *                                use that translation; else generic fallback
 *   - non-Error                → generic fallback
 *
 * When `config.debugEnabled` is true, the raw error message is appended to the
 * body so developers can see the underlying detail without losing the
 * user-facing copy.
 */
export const useErrorToast = (): UseErrorToastResult => {
    const { showToast } = useToast()
    const { getMessage } = useAlgodErrorMessage()
    const { t } = useLanguage()

    const showError = useCallback(
        (
            error: unknown,
            fallbackTitle?: string,
            options?: ToastOptions,
        ): void => {
            const resolved = resolveMessage(error, fallbackTitle, t, getMessage)
            const body = config.debugEnabled
                ? appendDebug(resolved.body, error)
                : resolved.body

            showToast({ title: resolved.title, body, type: 'error' }, options)
        },
        [showToast, getMessage, t],
    )

    return { showError }
}

const resolveMessage = (
    error: unknown,
    fallbackTitle: Optional<string>,
    t: (key: string) => string,
    getMessage: (err: unknown) => { title: string; body: string },
): { title: string; body: string } => {
    if (isPeraNetworkError(error)) {
        const { titleKey, bodyKey } = getNetworkErrorMessageKeys(error)
        const title =
            error.kind === 'unknown'
                ? (fallbackTitle ?? t(titleKey))
                : t(titleKey)
        return { title, body: t(bodyKey) }
    }

    if (error instanceof AlgodError) {
        return getMessage(error)
    }

    if (error instanceof AppError) {
        return {
            title: fallbackTitle ?? t('errors.general.title'),
            body: error.message || t('errors.general.body'),
        }
    }

    if (error instanceof Error) {
        // Raw Errors from algokit/algosdk may carry an algod node message we
        // can translate. If toAlgodError lands on `unknown_node_error` it
        // means we couldn't recognize anything — fall back to the caller's
        // generic title/body rather than the algod-flavored generic.
        const algodError = toAlgodError(error)
        if (algodError.code !== 'unknown_node_error') {
            return getMessage(algodError)
        }

        logger.error('Unrecognized node error shown as generic banner', {
            message: error.message,
        })
        return {
            title: fallbackTitle ?? t('errors.general.title'),
            body: t('errors.general.body'),
        }
    }

    logger.error('Unrecognized node error shown as generic banner', {
        message: String(error),
    })
    return {
        title: fallbackTitle ?? t('errors.general.title'),
        body: t('errors.general.body'),
    }
}

const appendDebug = (body: string, error: unknown): string => {
    const detail = extractDebugDetail(error)
    if (!detail) return body
    return `${body}\n\nDebug: ${detail}`
}

const extractDebugDetail = (error: unknown): string | null => {
    if (error instanceof Error) return error.message || error.name
    if (error == null) return null
    try {
        return typeof error === 'string' ? error : JSON.stringify(error)
    } catch {
        return String(error)
    }
}
