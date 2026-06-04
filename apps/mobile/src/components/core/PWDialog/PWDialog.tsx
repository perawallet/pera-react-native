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

import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getTestProps } from '@utils/test-id-helper'
import { PWOverlay } from '../PWOverlay'
import { PWScrollView } from '../PWScrollView'
import { PWText } from '../PWText'
import { PWView } from '../PWView'
import { useStyles } from './styles'

import type { ReactNode } from 'react'

export type PWDialogProps = {
    isVisible: boolean
    title?: ReactNode
    /** Accessibility label for dialogs that render their own title content. */
    accessibilityLabel?: string
    children: ReactNode
    footer?: ReactNode
    maxHeightRatio?: number
    dismissOnBackdropPress?: boolean
    onBackdropPress?: () => void
    testID?: string
}

export const PWDialog = ({
    isVisible,
    title,
    accessibilityLabel,
    children,
    footer,
    maxHeightRatio = 0.7,
    dismissOnBackdropPress = true,
    onBackdropPress,
    testID,
}: PWDialogProps) => {
    const { width, height } = useWindowDimensions()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ width, height, insets, maxHeightRatio })
    const titleLabel =
        accessibilityLabel ?? (typeof title === 'string' ? title : undefined)

    return (
        <PWOverlay
            isVisible={isVisible}
            onBackdropPress={
                dismissOnBackdropPress ? onBackdropPress : undefined
            }
            overlayStyle={styles.overlay}
            backdropStyle={styles.backdrop}
        >
            <PWView
                style={styles.dialog}
                accessibilityViewIsModal
                accessibilityLabel={titleLabel}
                {...getTestProps(testID)}
            >
                {title != null ? (
                    <PWView
                        style={styles.header}
                        accessibilityRole='header'
                    >
                        {typeof title === 'string' ? (
                            <PWText
                                variant='h3'
                                style={styles.title}
                            >
                                {title}
                            </PWText>
                        ) : (
                            title
                        )}
                    </PWView>
                ) : null}

                <PWScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {children}
                </PWScrollView>

                {footer != null ? (
                    <PWView style={styles.footer}>{footer}</PWView>
                ) : null}
            </PWView>
        </PWOverlay>
    )
}
