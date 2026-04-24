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

import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

import type { IconName, PWButtonProps, PWIconVariant } from '@components/core'

/**
 * Generic confirmation bottom sheet. Callers supply labels, the
 * confirm/cancel handlers, and — if they want one — an icon. No default
 * icon is rendered so the component doesn't quietly assume a destructive
 * context. Button variants default to primary/secondary; override per
 * callsite when the design diverges.
 */
export type ConfirmActionBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onConfirm: () => void
    icon?: IconName
    iconVariant?: PWIconVariant
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    testID?: string
}

export const ConfirmActionBottomSheet = ({
    isVisible,
    onClose,
    onConfirm,
    icon,
    iconVariant = 'primary',
    title,
    message,
    confirmLabel,
    cancelLabel,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    testID,
}: ConfirmActionBottomSheetProps) => {
    const styles = useStyles()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            enableContentPanningGesture
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
            <PWText
                variant='body'
                style={styles.message}
            >
                {message}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant={confirmVariant}
                    title={confirmLabel}
                    onPress={onConfirm}
                />
                <PWButton
                    variant={cancelVariant}
                    title={cancelLabel}
                    onPress={onClose}
                />
            </PWView>
        </PWBottomSheet>
    )
}
