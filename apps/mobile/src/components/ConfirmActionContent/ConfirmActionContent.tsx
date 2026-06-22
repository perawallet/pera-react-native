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

import {
    PWButton,
    PWIcon,
    PWText,
    PWView,
    type IconName,
    type PWButtonProps,
    type PWIconVariant,
} from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

import type { ReactNode } from 'react'

export type ConfirmActionContentProps<TResult = boolean> = {
    icon?: IconName
    iconVariant?: PWIconVariant
    title?: string
    message?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    tertiaryLabel?: string
    confirmValue?: TResult
    tertiaryValue?: TResult
    onConfirm?: () => void
    onCancel?: () => void
    onTertiary?: () => void
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    tertiaryVariant?: PWButtonProps['variant']
    buttonPaddingStyle?: PWButtonProps['paddingStyle']
    testID?: string
    confirmTestID?: string
    cancelTestID?: string
}

export const ConfirmActionContent = <TResult = boolean,>({
    icon,
    iconVariant = 'primary',
    title,
    message,
    confirmLabel,
    cancelLabel,
    tertiaryLabel,
    confirmValue = true as TResult,
    tertiaryValue,
    onConfirm,
    onCancel,
    onTertiary,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    tertiaryVariant = 'errorLink',
    buttonPaddingStyle,
    testID,
    confirmTestID,
    cancelTestID,
}: ConfirmActionContentProps<TResult>) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({
        bottomInset: insets.bottom,
        hasActions: !!confirmLabel,
    })
    const { resolve, dismiss } = useBottomSheetResult<TResult>()

    const handleConfirm = onConfirm ?? (() => resolve(confirmValue))
    const handleCancel = onCancel ?? dismiss
    const handleTertiary =
        onTertiary ?? (() => resolve(tertiaryValue as TResult))

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
                        testID={confirmTestID}
                    />
                    {!!cancelLabel && (
                        <PWButton
                            variant={cancelVariant}
                            title={cancelLabel}
                            onPress={handleCancel}
                            paddingStyle={buttonPaddingStyle}
                            testID={cancelTestID}
                        />
                    )}
                    {!!tertiaryLabel && (
                        <PWButton
                            variant={tertiaryVariant}
                            title={tertiaryLabel}
                            onPress={handleTertiary}
                            paddingStyle={buttonPaddingStyle}
                        />
                    )}
                </PWView>
            )}
        </PWView>
    )
}
