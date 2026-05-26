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

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type { IconName, PWButtonProps, PWIconVariant } from '@components/core'

/**
 * Generic confirmation bottom-sheet content. Callers supply labels and
 * — if they want one — an icon. The component resolves the host
 * bottom-sheet promise with `true` when the user confirms and dismisses
 * (resolving with `undefined`) when the user cancels or closes via the
 * backdrop / pan gesture. No default icon is rendered so the component
 * doesn't quietly assume a destructive context. Button variants default
 * to primary/secondary; override per callsite when the design diverges.
 *
 * `message` accepts a plain string (rendered as centered body copy) or
 * any ReactNode for callers needing multi-line / interpolated content.
 */
export type ConfirmActionContentProps = {
    icon?: IconName
    iconVariant?: PWIconVariant
    title: string
    message: ReactNode
    confirmLabel: string
    cancelLabel: string
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    /** Forwarded to both action buttons. Defaults to PWButton's default. */
    buttonPaddingStyle?: PWButtonProps['paddingStyle']
    testID?: string
}

export const ConfirmActionContent = ({
    icon,
    iconVariant = 'primary',
    title,
    message,
    confirmLabel,
    cancelLabel,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    buttonPaddingStyle,
    testID,
}: ConfirmActionContentProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { resolve, dismiss } = useBottomSheetResult<boolean>()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            {!!icon && (
                <PWIcon
                    name={icon}
                    variant={iconVariant}
                    size='xxl'
                    style={styles.icon}
                />
            )}
            <PWText variant='h3'>{title}</PWText>
            {typeof message === 'string' ? (
                <PWText
                    variant='body'
                    style={styles.message}
                >
                    {message}
                </PWText>
            ) : (
                <PWView style={styles.message}>{message}</PWView>
            )}
            <PWView style={styles.actions}>
                <PWButton
                    variant={confirmVariant}
                    title={confirmLabel}
                    onPress={() => resolve(true)}
                    paddingStyle={buttonPaddingStyle}
                />
                <PWButton
                    variant={cancelVariant}
                    title={cancelLabel}
                    onPress={dismiss}
                    paddingStyle={buttonPaddingStyle}
                />
            </PWView>
        </PWView>
    )
}
