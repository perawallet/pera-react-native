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

import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getTestProps } from '@utils/test-id-helper'
import { PWView } from '../PWView'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleProp,
    ViewStyle,
} from 'react-native'

export type PWSheetLayoutProps = {
    /**
     * Toolbar slot (typically `<SheetHeader />`). Pinned to the top while the
     * body scrolls beneath it. Omit for sheets without a toolbar.
     */
    header?: ReactNode
    /** Scrollable body, including any CTA at its end. */
    children: ReactNode
    /** Extra style merged onto the body's padding wrapper. */
    bodyStyle?: StyleProp<ViewStyle>
    /**
     * Forwarded to the scroll view — e.g. to gate a CTA on scroll-to-bottom.
     */
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    testID?: string
}

/**
 * Bottom-sheet body: a sticky toolbar above a scrolling column, both inside one
 * scroll so the sheet sizes to its full content (host `size='auto'`) and the
 * body scrolls under the pinned header once the content outgrows the sheet.
 * CTAs live at the end of the body.
 */
export const PWSheetLayout = ({
    header,
    children,
    bodyStyle,
    onScroll,
    testID,
}: PWSheetLayoutProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })

    return (
        <BottomSheetScrollView
            style={styles.scrollView}
            stickyHeaderIndices={header != null ? [0] : undefined}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            onScroll={onScroll}
            {...getTestProps(testID)}
        >
            {header != null ? (
                <PWView style={styles.header}>{header}</PWView>
            ) : null}
            <PWView style={[styles.body, bodyStyle, styles.bodyBottom]}>
                {children}
            </PWView>
        </BottomSheetScrollView>
    )
}
