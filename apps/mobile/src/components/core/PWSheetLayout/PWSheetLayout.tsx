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
import { useKeyboardState } from 'react-native-keyboard-controller'
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
    header?: ReactNode
    children: ReactNode
    footer?: ReactNode
    horizontalPadding?: 'xl' | 'none'
    bodyStyle?: StyleProp<ViewStyle>
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    testID?: string
}

/** Bottom-sheet skeleton: sticky header, scrolling body, optional footer. */
export const PWSheetLayout = ({
    header,
    children,
    footer,
    horizontalPadding = 'xl',
    bodyStyle,
    onScroll,
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

    // No footer: the scroll fills the sheet exactly as before.
    if (footer == null) {
        return scrollable
    }

    // With a footer: a column lets the scroll shrink so the footer stays pinned
    // below it (above the host's safe-area inset).
    return (
        <PWView style={styles.root}>
            {scrollable}
            <PWView style={styles.footer}>{footer}</PWView>
        </PWView>
    )
}
