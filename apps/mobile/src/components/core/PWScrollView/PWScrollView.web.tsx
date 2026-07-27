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

// Web replacement for PWScrollView: the native version renders gorhom's
// `BottomSheetScrollView` whenever `isInBottomSheet` is true (either the
// explicit `inBottomSheet` prop or the auto-detected `PWInBottomSheetContext`
// — a plain ScrollView silently fails to scroll inside a real gorhom sheet).
// On web, PWBottomSheet.web.tsx renders a plain Modal instead — no gorhom
// provider ever exists — so `BottomSheetScrollView` throws
// "'useBottomSheetInternal' cannot be used out of the BottomSheet!" the
// instant a component like SwapIntroductionContent renders inside a sheet.
// That's an uncaught error caught by AppShell.web's WebShellErrorBoundary (or
// App.web's outer RootBoundary), so it shows the shell's error fallback
// rather than a blank screen — still broken UX, but not a full app unmount.
// This file always renders the plain gesture-handler ScrollView — no
// `@gorhom/bottom-sheet` import at all — so it can never hit that failure.
// The `isInBottomSheet` calculation is kept because it still feeds
// `bottomInset` (a sheet has no tab bar to clear, native or not).
import { useContext } from 'react'
import { getContainerTestProps } from '@utils/test-id-helper'
import { type ScrollViewProps, StyleSheet } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWInBottomSheetContext } from '../PWBottomSheet/inSheetContext'
import { useStyles } from './styles'

export type PWScrollViewProps = ScrollViewProps & {
    testID?: string
    /** On web this only feeds the bottom-inset calc below (see file header) — it doesn't swap in a different scroll component. */
    inBottomSheet?: boolean
}

export const PWScrollView = ({
    testID,
    inBottomSheet,
    children,
    keyboardShouldPersistTaps,
    contentContainerStyle,
    showsVerticalScrollIndicator = false,
    showsHorizontalScrollIndicator = false,
    ...props
}: PWScrollViewProps) => {
    const insets = useSafeAreaInsets()
    const isInTabNavigator = useContext(BottomTabBarHeightContext) !== undefined
    // Auto-detect a surrounding sheet: only used for the bottomInset calc
    // below on web — never selects gorhom's BottomSheetScrollView.
    const isInSheet = useContext(PWInBottomSheetContext)
    const isInBottomSheet = inBottomSheet ?? isInSheet
    const bottomInset = isInBottomSheet || !isInTabNavigator ? insets.bottom : 0
    const styles = useStyles({ bottomInset })

    // Skip the default bottom padding if the caller set any bottom-affecting
    // padding: RN edge-specificity would otherwise silently override theirs.
    const callerPadding = StyleSheet.flatten(contentContainerStyle) ?? {}
    const hasBottomPadding =
        callerPadding.paddingBottom != null ||
        callerPadding.paddingVertical != null ||
        callerPadding.padding != null
    const resolvedContentContainerStyle = hasBottomPadding
        ? contentContainerStyle
        : [styles.contentContainer, contentContainerStyle]

    return (
        <ScrollView
            // RN's default ('never') swallows the first tap on a child while an
            // input is focused; 'handled' lets the tap through.
            keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
            contentContainerStyle={resolvedContentContainerStyle}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
            {...getContainerTestProps(testID)}
            {...props}
        >
            {children}
        </ScrollView>
    )
}
