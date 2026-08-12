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

import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { PWView } from '@components/core/PWView'
import { getTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native'

export type PWListItemLayoutProps = {
    /**
     * Sticky leading slot (icon, avatar, overlapping logos). Sized to its
     * content by default; set `leftFlex`/`leftMaxWidthRatio` to let it grow and
     * truncate.
     */
    left?: ReactNode
    /** Flexible main slot. Fills the space the sticky slots leave behind. */
    children: ReactNode
    /** Sticky trailing slot (value, chevron, action). Never shrinks. */
    right?: ReactNode
    /**
     * Hairline divider aligned to the start of the `center` slot, running to the
     * item's trailing edge (it clears the `left` slot).
     */
    showDivider?: boolean
    /**
     * Flex-grow weight for the left slot. `0` (default) keeps it sticky
     * (content-sized); a positive value lets it grow alongside the center.
     */
    leftFlex?: number
    /**
     * Caps the left slot to this fraction (0–1) of the row width so its content
     * truncates past the cap. Omit to size the slot to its content.
     */
    leftMaxWidthRatio?: number
    /** Flex-grow weight for the center slot (default `1`). */
    centerFlex?: number
    /**
     * Vertical alignment of the sticky slots against the content. `center`
     * (default) suits single-line rows; `top` pins the leading/trailing slots
     * to the first line for multi-line rows (inbox, notifications).
     */
    align?: 'center' | 'top'
    /**
     * Press handler. Accepts the RN press signature so callers that forward a
     * `(event) => void` handler (e.g. navigation rows) type-check; handlers that
     * ignore the event (`() => void`) remain assignable too.
     */
    onPress?: (event: GestureResponderEvent) => void
    /** Long-press handler (e.g. copy-to-clipboard rows). Either handler alone
     *  makes the row touchable. */
    onLongPress?: (event: GestureResponderEvent) => void
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const PWListItemLayout = ({
    left,
    children,
    right,
    showDivider = false,
    leftFlex = 0,
    leftMaxWidthRatio,
    centerFlex = 1,
    align = 'center',
    onPress,
    onLongPress,
    style,
    testID,
}: PWListItemLayoutProps) => {
    const styles = useStyles({ leftFlex, leftMaxWidthRatio, centerFlex, align })

    const content = (
        <>
            {left != null ? <PWView style={styles.left}>{left}</PWView> : null}
            <PWView style={styles.body}>
                <PWView style={styles.contentRow}>
                    <PWView style={styles.center}>{children}</PWView>
                    {right != null ? (
                        <PWView style={styles.right}>{right}</PWView>
                    ) : null}
                </PWView>
                {showDivider ? (
                    <PWView
                        style={styles.divider}
                        {...getTestProps(
                            testID == null ? undefined : `${testID}-divider`,
                        )}
                    />
                ) : null}
            </PWView>
        </>
    )

    if (onPress == null && onLongPress == null) {
        return (
            <PWView
                style={[styles.row, style]}
                {...getTestProps(testID)}
            >
                {content}
            </PWView>
        )
    }

    return (
        <PWTouchableOpacity
            style={[styles.row, style]}
            onPress={onPress}
            onLongPress={onLongPress}
            {...getTestProps(testID)}
        >
            {content}
        </PWTouchableOpacity>
    )
}
