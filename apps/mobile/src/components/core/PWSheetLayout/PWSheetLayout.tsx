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

import { useCallback, useState } from 'react'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { getTestProps } from '@utils/test-id-helper'
import { PWView } from '../PWView'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

export type PWSheetLayoutProps = {
    /**
     * Fixed toolbar slot (typically `<SheetHeader />`). Sits above the scroll
     * and stays put while the body scrolls. Omit for sheets without a toolbar.
     */
    header?: ReactNode
    /**
     * Fixed CTA slot (e.g. `PWButton` / `PWSlideToConfirm`). Sits below the
     * scroll. Omit for sheets without a footer.
     */
    footer?: ReactNode
    /** Scrollable body, including any content heading/illustration. */
    children: ReactNode
    /** Extra style merged onto the scroll's content container. */
    bodyStyle?: StyleProp<ViewStyle>
    testID?: string
}

/**
 * Three-zone bottom-sheet body: a fixed toolbar, a scrollable middle, and a
 * fixed footer — all in-flow siblings of one column, so the whole sheet pans
 * and dismisses as a single surface (a gorhom `footerComponent` would instead
 * pin to the screen and not follow the pan). The `flex:1` scroll takes the
 * space between toolbar and footer; the body scrolls when it overflows.
 *
 * Requires a BOUNDED host (`PWBottomSheet` `size='lg'`/`'md'`/`'full'`): the
 * `flex:1` scroll only bounds when the sheet has a definite height. With
 * `size='auto'`, gorhom sizes the sheet to the scroll's content and the footer
 * is pushed off-screen.
 */
export const PWSheetLayout = ({
    header,
    footer,
    children,
    bodyStyle,
    testID,
}: PWSheetLayoutProps) => {
    const styles = useStyles()

    // Disable scroll (and its bounce) while the content fits; enable once it
    // overflows. Default to enabled until measured so content is never trapped.
    const [viewportHeight, setViewportHeight] = useState(0)
    const [contentHeight, setContentHeight] = useState(0)
    const isMeasured = viewportHeight > 0 && contentHeight > 0
    const isScrollable = !isMeasured || contentHeight > viewportHeight + 1

    const handleScrollLayout = useCallback((event: LayoutChangeEvent) => {
        setViewportHeight(event.nativeEvent.layout.height)
    }, [])

    const handleContentSizeChange = useCallback(
        (_width: number, height: number) => {
            setContentHeight(height)
        },
        [],
    )

    return (
        <>
            {header}
            <BottomSheetScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, bodyStyle]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps='handled'
                scrollEnabled={isScrollable}
                onLayout={handleScrollLayout}
                onContentSizeChange={handleContentSizeChange}
                {...getTestProps(testID)}
            >
                {children}
            </BottomSheetScrollView>
            {footer != null ? (
                <PWView style={styles.footer}>{footer}</PWView>
            ) : null}
        </>
    )
}
