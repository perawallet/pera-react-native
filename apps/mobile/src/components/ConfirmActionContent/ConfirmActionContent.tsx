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
 * Shared layout for icon + title + body + action(s) bottom-sheet content —
 * the standard "result / warning / confirm / info" sheet. Owns the icon size,
 * spacing, title (centered) and body (left-aligned) alignment, the bottom
 * safe-area inset and full-width buttons so every sheet of this shape stays
 * visually consistent. No default icon is rendered so the component doesn't
 * quietly assume a destructive context.
 *
 * `message` accepts a plain string (left-aligned body copy) or any ReactNode
 * for callers needing multi-line / interpolated content.
 *
 * Buttons: the confirm button is always shown; the cancel button only renders
 * when `cancelLabel` is supplied, so single-action sheets ("Ok" / "Done") use
 * the same layout. By default confirm resolves the host bottom-sheet promise
 * with `true` (override the value via `confirmValue` / the `TResult` generic,
 * e.g. `'confirm' | 'go-to-settings'`) and cancel dismisses it. Callback-based
 * sheets that don't drive the host promise supply `onConfirm` / `onCancel`.
 */
export type ConfirmActionContentProps<TResult = boolean> = {
    icon?: IconName
    iconVariant?: PWIconVariant
    /** Optional heading. Omit for a body-only sheet. */
    title?: string
    /** Title alignment. Defaults to `center` (result/warning convention). */
    titleAlign?: 'left' | 'center'
    /** Optional body copy. Omit for a title-only sheet. */
    message?: ReactNode
    /** Omit to render an action-less sheet (e.g. an auto-dismissing result). */
    confirmLabel?: string
    /** Omit to render a single-action sheet (no cancel button). */
    cancelLabel?: string
    /** Value the host bottom-sheet promise resolves with on confirm. Defaults to `true`. */
    confirmValue?: TResult
    /** Override the confirm press (defaults to resolving the host promise). */
    onConfirm?: () => void
    /** Override the cancel press (defaults to dismissing the host sheet). */
    onCancel?: () => void
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    /** Forwarded to both action buttons. Defaults to PWButton's default. */
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
