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

// Host-agnostic presentation for a confirm/acknowledge panel: icon, title,
// message and up to two buttons. Split out of ConfirmActionContent so the same
// visuals can render OUTSIDE a bottom sheet — ConfirmActionContent calls
// `useBottomSheetResult()`, which THROWS without a BottomSheetIdContext, so it
// cannot be used on the extension's approval page (its own top-level document,
// with no sheet host). ConfirmActionContent remains the sheet-bound wrapper and
// its public API is unchanged; this component takes its button handlers
// explicitly instead of deriving them from the sheet.
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
import { useStyles } from './styles'

import type { ReactNode } from 'react'

export type ConfirmActionLayoutProps = {
    icon?: IconName
    iconVariant?: PWIconVariant
    title?: string
    message?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
    onCancel: () => void
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    buttonPaddingStyle?: PWButtonProps['paddingStyle']
    testID?: string
    confirmTestID?: string
    cancelTestID?: string
}

export const ConfirmActionLayout = ({
    icon,
    iconVariant = 'primary',
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    buttonPaddingStyle,
    testID,
    confirmTestID,
    cancelTestID,
}: ConfirmActionLayoutProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({
        bottomInset: insets.bottom,
        hasActions: !!confirmLabel,
    })

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
                        onPress={onConfirm}
                        paddingStyle={buttonPaddingStyle}
                        testID={confirmTestID}
                    />
                    {!!cancelLabel && (
                        <PWButton
                            variant={cancelVariant}
                            title={cancelLabel}
                            onPress={onCancel}
                            paddingStyle={buttonPaddingStyle}
                            testID={cancelTestID}
                        />
                    )}
                </PWView>
            )}
        </PWView>
    )
}
