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
    Notifier,
    type NotifierRoot,
    type ShowNotificationParams,
} from 'react-native-notifier'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    SHORT_PROMPT_DISPLAY_DELAY,
    LONG_PROMPT_DISPLAY_DELAY,
} from '@constants/ui'
import { getContainerTestProps } from '@utils/test-id-helper'
import { useToastStyles } from './styles'

interface ToastMessage {
    title: string
    body: string
    type: 'error' | 'warning' | 'info' | 'success'
}

const DELAY_MAP = {
    none: 0,
    short: SHORT_PROMPT_DISPLAY_DELAY,
    long: LONG_PROMPT_DISPLAY_DELAY,
} as const

type ToastOptions = ShowNotificationParams & {
    notifier?: NotifierRoot
    delayLength?: 'none' | 'short' | 'long'
}

export const useToast = () => {
    const insets = useSafeAreaInsets()
    const styles = useToastStyles({ topInset: insets.top })

    const showToast = useCallback(
        (message: ToastMessage, options?: ToastOptions) => {
            let containerStyle = styles.infoStyle
            let textStyle = styles.infoStyleText
            if (message.type === 'error') {
                containerStyle = styles.errorStyle
                textStyle = styles.errorStyleText
            } else if (message.type === 'warning') {
                containerStyle = styles.warningStyle
                textStyle = styles.warningStyleText
            } else if (message.type === 'success') {
                containerStyle = styles.successStyle
                textStyle = styles.successStyleText
            }

            const {
                delayLength = 'none',
                notifier: customNotifier,
                ...notifierOptions
            } = options ?? {}

            const delay = DELAY_MAP[delayLength]

            const notifier = customNotifier ?? Notifier

            setTimeout(() => {
                notifier.showNotification({
                    title: message.title,
                    description: message.body,
                    containerStyle: styles.notifierContainer,
                    componentProps: {
                        containerStyle: [styles.baseStyle, containerStyle],
                        titleStyle: textStyle,
                        descriptionStyle: textStyle,
                    },
                    containerProps: getContainerTestProps(
                        `toast_${message.type}`,
                    ),
                    ...notifierOptions,
                })
            }, delay)
        },
        [styles],
    )

    const infoToast = useCallback(
        (title: string, body: string) => {
            showToast({ title, body, type: 'info' })
        },
        [showToast],
    )

    const errorToast = useCallback(
        (title: string, body: string, options?: ToastOptions) => {
            showToast({ title, body, type: 'error' }, options)
        },
        [showToast],
    )

    const successToast = useCallback(
        (title: string, body: string) => {
            showToast({ title, body, type: 'success' })
        },
        [showToast],
    )

    /**
     * Hides the currently visible toast (no-op when none is up). For flows
     * that discover their own error toast became stale — e.g. a WC pairing
     * that recovers after its timeout toast was shown.
     */
    const hideToast = useCallback((notifier?: NotifierRoot) => {
        ;(notifier ?? Notifier).hideNotification()
    }, [])

    return {
        showToast,
        infoToast,
        errorToast,
        successToast,
        hideToast,
    }
}
