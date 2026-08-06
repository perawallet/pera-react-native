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
import { config } from '@perawallet/wallet-core-config'
import {
    type ShowNotificationParams,
    type NotifierRoot,
} from 'react-native-notifier'
import { resolveErrorCopy } from '@i18n/resolveErrorCopy'
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
 * Copy resolution lives in {@link resolveErrorCopy}; this hook only handles
 * toast presentation. When `config.debugEnabled` is true, the raw error
 * message is appended to the body so developers can see the underlying
 * detail without losing the user-facing copy.
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
            const resolved = resolveErrorCopy(
                error,
                t,
                fallbackTitle,
                getMessage,
            )
            const body = config.debugEnabled
                ? appendDebug(resolved.body, error)
                : resolved.body

            showToast({ title: resolved.title, body, type: 'error' }, options)
        },
        [showToast, getMessage, t],
    )

    return { showError }
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
