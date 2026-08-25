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

import { AlgodError, toAlgodError } from '@perawallet/wallet-core-blockchain'
import { SubmissionError } from '@perawallet/wallet-core-signing'
import {
    AppError,
    ErrorCategory,
    NoConnectionError,
    getNetworkErrorMessageKeys,
    isPeraNetworkError,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'

export type ErrorCopy = { title: string; body: string }

export type TranslateFn = (
    key: string,
    params?: Record<string, unknown>,
) => string

export type AlgodMessageFn = (err: unknown) => ErrorCopy

/**
 * Errors declare a body key, not a title. Titles come from the category so a
 * new error never has to invent one — `metadata.titleKey` is the opt-out, for
 * errors specific enough to name the situation themselves.
 *
 * Exhaustive `Record` on purpose: adding an `ErrorCategory` is a compile error
 * until someone classifies it here.
 */
export const TITLE_KEY_BY_CATEGORY: Record<ErrorCategory, string> = {
    [ErrorCategory.ACCOUNTS]: 'errors.account.title',
    [ErrorCategory.KMS]: 'errors.account.title',
    [ErrorCategory.TRANSACTIONS]: 'errors.transaction.title',
    [ErrorCategory.BLOCKCHAIN]: 'errors.transaction.title',
    [ErrorCategory.ASSETS]: 'errors.general.title',
    [ErrorCategory.NETWORK]: 'errors.general.title',
    [ErrorCategory.STAKING]: 'errors.general.title',
    [ErrorCategory.STORAGE]: 'errors.general.title',
    [ErrorCategory.UNKNOWN]: 'errors.general.title',
    [ErrorCategory.VALIDATION]: 'errors.general.title',
    [ErrorCategory.WALLETCONNECT]: 'errors.general.title',
}

/**
 * Single source of truth for turning any thrown value into user-facing copy.
 *
 * Branch order is load-bearing: PeraNetworkError and NoConnectionError are both
 * AppError subclasses, so they must be tested before the AppError branch or
 * they would never match.
 */
export const resolveErrorCopy = (
    error: unknown,
    t: TranslateFn,
    fallbackTitle: Optional<string>,
    getAlgodMessage: AlgodMessageFn,
): ErrorCopy => {
    if (isPeraNetworkError(error)) {
        const { titleKey, bodyKey } = getNetworkErrorMessageKeys(error)
        const title =
            error.kind === 'unknown'
                ? (fallbackTitle ?? t(titleKey))
                : t(titleKey)
        return { title, body: t(bodyKey) }
    }

    if (error instanceof AlgodError) {
        return getAlgodMessage(error)
    }

    // Before the AppError branch: SubmissionError is an AppError subclass and
    // would otherwise lose its structured algod copy to the generic banner.
    if (error instanceof SubmissionError) {
        // No node verdict and chain verification came up empty — the
        // transaction may still have landed, so neither "failed" nor
        // "no connection" is honest here.
        if (error.classification === 'unknown-outcome') {
            return {
                title: t('errors.submission.unknown_outcome.title'),
                body: t('errors.submission.unknown_outcome.body'),
            }
        }
        return getAlgodMessage(error.algodError)
    }

    if (error instanceof NoConnectionError) {
        const { titleKey, bodyKey } = getNetworkErrorMessageKeys(error)
        return { title: t(titleKey), body: t(bodyKey) }
    }

    if (error instanceof AppError) {
        const { messageKey, titleKey, params, category } = error.metadata
        if (messageKey) {
            return {
                title: titleKey
                    ? t(titleKey)
                    : (fallbackTitle ?? t(TITLE_KEY_BY_CATEGORY[category])),
                body: t(messageKey, params),
            }
        }
        // No declared key means the error is internal; `message` is log-only.
        return {
            title: fallbackTitle ?? t('errors.general.title'),
            body: t('errors.general.body'),
        }
    }

    if (error instanceof Error) {
        // Raw Errors from algokit/algosdk may carry an algod node message we can
        // translate. Landing on `unknown_node_error` means nothing was
        // recognized — prefer the caller's generic copy over the algod-flavored
        // one.
        const algodError = toAlgodError(error)
        if (algodError.code !== 'unknown_node_error') {
            return getAlgodMessage(algodError)
        }

        logger.error('Unrecognized error shown as generic banner', {
            message: error.message,
        })
        return {
            title: fallbackTitle ?? t('errors.general.title'),
            body: t('errors.general.body'),
        }
    }

    logger.error('Unrecognized error shown as generic banner', {
        message: String(error),
    })
    return {
        title: fallbackTitle ?? t('errors.general.title'),
        body: t('errors.general.body'),
    }
}
