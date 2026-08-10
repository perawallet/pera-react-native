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

import { useCallback, useRef, useState } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { useDeepLink } from '@hooks/useDeepLink'

type ErrorKind = 'none' | 'invalid' | 'failed'

export type UsePasteLinkContentResult = {
    value: string
    isSubmitting: boolean
    hasError: boolean
    // 'invalid': isValidDeepLink rejected the value outright ("not a link").
    // 'failed': isValidDeepLink accepted it but the dispatcher couldn't open
    // it (onError/onConnectionError) — a distinct case that needs distinct
    // copy, since the real reason is a toast the web bottom sheet swallows.
    errorMessageKey:
        | 'paste_link.error_invalid'
        | 'paste_link.error_failed'
        | null
    setValue: (next: string) => void
    handleSubmit: () => void
}

/**
 * Paste-a-deeplink entry point for the Menu. Accepts exactly what the QR
 * scanner accepted (`isValidDeepLink`) and dispatches through the same
 * `handleDeepLink` with source 'qr', so WalletConnect URIs, perawallet://
 * links and HTTPS deeplinks all behave identically to a scan.
 */
export const usePasteLinkContent = (
    onClose: () => void,
): UsePasteLinkContentResult => {
    const { handleDeepLink, isValidDeepLink } = useDeepLink()
    const [value, setRawValue] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorKind, setErrorKind] = useState<ErrorKind>('none')

    // Synchronous guard against a double submit (Enter plus a button tap)
    // landing two dispatches, mirroring the scanner's handlingRef.
    const isHandlingRef = useRef(false)

    const setValue = useCallback((next: string) => {
        setRawValue(next)
        setErrorKind('none')
    }, [])

    const handleSubmit = useCallback(() => {
        const trimmed = value.trim()
        if (trimmed.length === 0 || isHandlingRef.current) return

        if (!isValidDeepLink(trimmed)) {
            setErrorKind('invalid')
            return
        }

        isHandlingRef.current = true
        setIsSubmitting(true)
        setErrorKind('none')

        // Guards against both a callback firing AND the rejection handler
        // below running for the same dispatch — whichever gets there first
        // wins, the other is a no-op.
        let hasSettled = false
        const settle = (): void => {
            if (hasSettled) return
            hasSettled = true
            isHandlingRef.current = false
            setIsSubmitting(false)
        }

        void handleDeepLink(
            trimmed,
            false,
            'qr',
            () => {
                // The dispatcher already toasts where a toast applies; the
                // inline error covers the capability-gated paths that drop
                // silently. Sheet stays open for another attempt. This is
                // "recognised but couldn't open" — distinct copy from an
                // isValidDeepLink rejection above.
                settle()
                setErrorKind('failed')
            },
            () => {
                logger.debug('PasteLinkContent: deep link handled', {
                    value: trimmed,
                })
                settle()
                onClose()
            },
            () => {
                // e.g. a WalletConnect handshake rejected — same treatment as
                // onError: stay open, let them retry.
                settle()
                setErrorKind('failed')
            },
        ).catch((error: unknown) => {
            // `handleDeepLink` is a foreign Promise<void> — nothing guarantees
            // it resolves via one of the callbacks above. If it rejects
            // instead, settle anyway so the spinner and the double-submit
            // guard don't get stuck forever.
            logger.error('PasteLinkContent: deep link dispatch rejected', {
                value: trimmed,
                error,
            })
            settle()
        })
    }, [value, isValidDeepLink, handleDeepLink, onClose])

    const hasError = errorKind !== 'none'
    const errorMessageKey =
        errorKind === 'invalid'
            ? 'paste_link.error_invalid'
            : errorKind === 'failed'
              ? 'paste_link.error_failed'
              : null

    return {
        value,
        isSubmitting,
        hasError,
        errorMessageKey,
        setValue,
        handleSubmit,
    }
}
