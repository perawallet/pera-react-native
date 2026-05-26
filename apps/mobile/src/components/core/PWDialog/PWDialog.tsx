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
    /**
     * Title shown at the top. A string is rendered as a centered `h3` and
     * announced to screen readers; a node is rendered as-is.
     */
    title?: ReactNode
    /** Scrollable content; scrolls inside the box when it exceeds the max height. */
    children: ReactNode
    /** Fixed footer (e.g. CTAs) that stays visible while the content scrolls. */
    footer?: ReactNode
    /** Dialog max height as a ratio of the safe window height. Default `0.7`. */
    maxHeightRatio?: number
    /** Dismiss when the backdrop is pressed. Default `true`. */
    dismissOnBackdropPress?: boolean
    onBackdropPress?: () => void
    testID?: string
}

/**
 * Centered modal dialog. The wrapper (scrim) respects the safe area; the box is
 * capped at 70% of the safe window height (`maxHeightRatio`) and 560 wide, with
 * responsive horizontal margins. Content scrolls inside while an optional
 * `footer` stays pinned. For confirmation/permission/error flows prefer a named
 * domain component built on top of this, or a bottom sheet.
 */
export const PWDialog = ({
    isVisible,
    title,
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
    const titleLabel = typeof title === 'string' ? title : undefined

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
