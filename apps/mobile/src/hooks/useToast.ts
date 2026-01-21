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

import { ZINDEX_ORDER } from '@constants/ui'
import { makeStyles } from '@rneui/themed'
import { useCallback } from 'react'
import {
    Notifier,
    NotifierRoot,
    ShowNotificationParams,
} from 'react-native-notifier'

export interface ToastMessage {
    title: string
    body: string
    type: 'error' | 'warning' | 'info' | 'success'
}

const useStyles = makeStyles(theme => {
    return {
        baseStyle: {
            zIndex: ZINDEX_ORDER.max,
            marginTop: theme.spacing.xl,
            borderWidth: 0,
        },
        successStyle: {
            backgroundColor: theme.colors.success,
        },
        successStyleText: {
            color: theme.colors.white,
        },
        errorStyle: {
            backgroundColor: theme.colors.error,
        },
        errorStyleText: {
            color: theme.colors.white,
        },
        infoStyle: {
            backgroundColor: theme.colors.background,
        },
        infoStyleText: {
            color: theme.colors.textMain,
        },
        warningStyle: {
            backgroundColor: theme.colors.warning,
        },
        warningStyleText: {
            color: theme.colors.textMain,
        },
    }
})

export const useToast = () => {
    const styles = useStyles()

    const showToast = useCallback(
        (
            message: ToastMessage,
            options?: ShowNotificationParams & { notifier?: NotifierRoot },
        ) => {
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

            const notifier = options?.notifier ?? Notifier
            notifier.showNotification({
                title: message.title,
                description: message.body,
                componentProps: {
                    containerStyle: [styles.baseStyle, containerStyle],
                    titleStyle: textStyle,
                    descriptionStyle: textStyle,
                },
                ...options,
            })
        },
        [styles],
    )

    return {
        showToast,
    }
}
