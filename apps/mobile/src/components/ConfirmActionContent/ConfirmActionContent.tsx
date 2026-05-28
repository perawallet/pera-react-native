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

/** Standard icon + title + body + actions bottom-sheet layout. */
export type ConfirmActionContentProps<TResult = boolean> = {
    icon?: IconName
    iconVariant?: PWIconVariant
    title?: string
    titleAlign?: 'left' | 'center'
    message?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    confirmValue?: TResult
    onConfirm?: () => void
    onCancel?: () => void
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    buttonPaddingStyle?: PWButtonProps['paddingStyle']
    testID?: string
}

export const ConfirmActionContent = <TResult = boolean,>({
    icon,
    iconVariant = 'primary',
    title,
    titleAlign = 'center',
    message,
    confirmLabel,
    cancelLabel,
    confirmValue = true as TResult,
    onConfirm,
    onCancel,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    buttonPaddingStyle,
    testID,
}: ConfirmActionContentProps<TResult>) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({
        bottomInset: insets.bottom,
        titleAlign,
        hasActions: !!confirmLabel,
    })
    const { resolve, dismiss } = useBottomSheetResult<TResult>()

    const handleConfirm = onConfirm ?? (() => resolve(confirmValue))
    const handleCancel = onCancel ?? dismiss

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
            {!!title && (
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {title}
                </PWText>
            )}
            {typeof message === 'string' ? (
                <PWText
                    variant='body'
                    style={styles.message}
                >
                    {message}
                </PWText>
            ) : (
                !!message && <PWView style={styles.message}>{message}</PWView>
            )}
            {!!confirmLabel && (
                <PWView style={styles.actions}>
                    <PWButton
                        variant={confirmVariant}
                        title={confirmLabel}
                        onPress={handleConfirm}
                        paddingStyle={buttonPaddingStyle}
                    />
                    {!!cancelLabel && (
                        <PWButton
                            variant={cancelVariant}
                            title={cancelLabel}
                            onPress={handleCancel}
                            paddingStyle={buttonPaddingStyle}
                        />
                    )}
                </PWView>
            )}
        </PWView>
    )
}
