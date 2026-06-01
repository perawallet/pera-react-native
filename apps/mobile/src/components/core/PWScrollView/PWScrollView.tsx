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

import { useContext } from 'react'
import { getTestProps } from '@utils/test-id-helper'
import { ScrollViewProps, StyleSheet } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStyles } from './styles'

export type PWScrollViewProps = ScrollViewProps & {
    testID?: string
    /**
     * Render gorhom's `BottomSheetScrollView` so the scroll gesture cooperates
     * with the sheet's pan gesture. A plain ScrollView inside a bottom sheet
     * won't scroll. Mirrors `PWFlatList`'s `inBottomSheet`.
     */
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
    const bottomInset = inBottomSheet || !isInTabNavigator ? insets.bottom : 0
    const styles = useStyles({ bottomInset })

    // Guarantee the content clears the bottom edge — but only when the caller
    // hasn't already set a bottom-affecting padding. RN edge-specificity makes
    // an explicit `paddingBottom` win over a caller's `paddingVertical`, so a
    // blind merge would silently override their value; this opts out instead.
    const callerPadding = StyleSheet.flatten(contentContainerStyle) ?? {}
    const hasBottomPadding =
        callerPadding.paddingBottom != null ||
        callerPadding.paddingVertical != null ||
        callerPadding.padding != null
    const resolvedContentContainerStyle = hasBottomPadding
        ? contentContainerStyle
        : [styles.contentContainer, contentContainerStyle]

    if (inBottomSheet) {
        return (
            <BottomSheetScrollView
                keyboardShouldPersistTaps={
                    keyboardShouldPersistTaps ?? 'handled'
                }
                contentContainerStyle={resolvedContentContainerStyle}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
                {...getTestProps(testID)}
                {...props}
            >
                {children}
            </BottomSheetScrollView>
        )
    }

    return (
        <ScrollView
            // Default to `'handled'` so taps on touchable children fire
            // normally while taps on the scroll background still dismiss
            // the keyboard. RN's default of `'never'` swallows the tap on
            // the first interaction, which makes buttons appear unresponsive
            // when an input above them is focused.
            keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
            contentContainerStyle={resolvedContentContainerStyle}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
            {...getTestProps(testID)}
            {...props}
        >
            {children}
        </ScrollView>
    )
}
