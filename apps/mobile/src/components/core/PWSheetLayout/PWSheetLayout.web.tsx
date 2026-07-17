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

// Web replacement for PWSheetLayout: the native version always renders
// `BottomSheetScrollView` from `@gorhom/bottom-sheet` unconditionally (safe
// there because every call site is reached through the real gorhom
// `<BottomSheet>` that native's PWBottomSheet.tsx mounts). On web,
// PWBottomSheet.web.tsx renders a plain Modal instead — no gorhom provider
// ever exists — so `BottomSheetScrollView` throws
// "'useBottomSheetInternal' cannot be used out of the BottomSheet!" the
// instant any of this component's ~50 call sites render. That's an uncaught
// error with no root error boundary in the web tree, which unmounts the
// entire React app (not just the sheet), presenting as every bottom sheet
// opening blank. Swap in a plain ScrollView here, mirroring the
// PWInBottomSheetContext-gated pattern PWScreen/PWScrollView already use
// correctly for the same reason.
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardState } from 'react-native-keyboard-controller'
import { getTestProps } from '@utils/test-id-helper'
import { PWView } from '../PWView'
import { useStyles } from './styles'

import type { ReactNode } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { HorizontalPaddingMode } from '../PWScreen'

export type PWSheetLayoutProps = {
    header?: ReactNode
    children: ReactNode
    footer?: ReactNode
    horizontalPadding?: HorizontalPaddingMode
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    testID?: string
}

export const PWSheetLayout = ({
    header,
    children,
    footer,
    horizontalPadding = 'xl',
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
        <ScrollView
            style={styles.scrollView}
            stickyHeaderIndices={header != null ? [0] : undefined}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            onScroll={onScroll}
            {...getTestProps(testID)}
            accessible={false}
        >
            {header != null ? (
                <PWView style={styles.header}>{header}</PWView>
            ) : null}
            <PWView style={styles.body}>{children}</PWView>
        </ScrollView>
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
