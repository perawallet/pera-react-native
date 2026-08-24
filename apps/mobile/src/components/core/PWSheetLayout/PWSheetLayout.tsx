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

import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardState } from 'react-native-keyboard-controller'
import { getTestProps } from '@utils/test-id-helper'
import { PWView } from '../PWView'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native'
import type { HorizontalPaddingMode } from '../PWScreen'

export type PWSheetLayoutProps = {
    /** Sticky top zone — kept on screen while the body scrolls under it. */
    header?: ReactNode
    /** Scrollable body — the only required zone. Style the body via its own
     * content (like the header/footer slots), not a zone-level style prop. */
    children: ReactNode
    /** Sticky bottom zone, pinned below the body. */
    footer?: ReactNode
    horizontalPadding?: HorizontalPaddingMode
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    /** Body viewport size. Pair with `onContentSizeChange` to tell whether the
     * body actually overflows — a scroll-gated action never fires `onScroll`
     * when everything already fits. */
    onLayout?: (event: LayoutChangeEvent) => void
    onContentSizeChange?: (width: number, height: number) => void
    testID?: string
}

/**
 * Bottom-sheet layout with three stacked zones: an optional sticky `header`, a
 * scrollable `body`, and an optional sticky `footer` pinned below it. Mirrors
 * `PWScreen`'s `header`/`body`/`footer` slots for full screens. Open the sheet
 * with `autoCreateContainer: false` so the footer pins and the body scrolls.
 */
export const PWSheetLayout = ({
    header,
    children,
    footer,
    horizontalPadding = 'xl',
    onScroll,
    onLayout,
    onContentSizeChange,
    testID,
}: PWSheetLayoutProps) => {
    const insets = useSafeAreaInsets()
    const isKeyboardVisible = useKeyboardState(state => state.isVisible)
    const styles = useStyles({
        horizontalPadding,
        bottomInset: insets.bottom,
        hasFooter: footer != null,
        isKeyboardVisible,
    })

    const scrollable = (
        <BottomSheetScrollView
            style={styles.scrollView}
            stickyHeaderIndices={header != null ? [0] : undefined}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            onScroll={onScroll}
            onLayout={onLayout}
            onContentSizeChange={onContentSizeChange}
            {...getTestProps(testID)}
            accessible={false}
        >
            {header != null ? (
                <PWView style={styles.header}>{header}</PWView>
            ) : null}
            <PWView style={styles.body}>{children}</PWView>
        </BottomSheetScrollView>
    )

    if (footer == null) {
        return scrollable
    }

    return (
        <PWView style={styles.root}>
            {scrollable}
            <PWView style={styles.footer}>{footer}</PWView>
        </PWView>
    )
}
