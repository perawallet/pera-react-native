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

import { useCallback, useContext, useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import { useTheme } from '@rneui/themed'
import {
    KeyboardAwareScrollView,
    KeyboardStickyView,
    useKeyboardState,
} from 'react-native-keyboard-controller'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContext } from '@react-navigation/native'
import { getTestProps } from '@utils/test-id-helper'
import { PWView } from '../PWView'
import { usePWScreenInsets } from './usePWScreenInsets'
import { useStyles, type HorizontalPaddingMode } from './styles'

import type { ReactNode } from 'react'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

export type PWScreenProps = {
    children: ReactNode
    /**
     * - `true` (default): wraps children in a `KeyboardAwareScrollView` that
     *   auto-scrolls the focused input into view above the keyboard.
     * - `false`: children fill a flex:1 view (use when children own their
     *   own scrolling, e.g. PWFlatList). Keyboard auto-scroll does not apply.
     */
    scroll?: boolean
    /**
     * Horizontal padding mode applied to the body and footer.
     * Defaults to `'xl'` (theme.spacing.xl). Use `'none'` for full-bleed
     * screens that manage padding internally.
     */
    horizontalPadding?: HorizontalPaddingMode
    /**
     * Sticky footer rendered outside the scroll body. Rises with the keyboard
     * via `KeyboardStickyView` so it stays pinned just above it. The footer is
     * already wrapped in a padded container — pass multiple buttons directly
     * (e.g. a fragment) and use `footerStyle` for gap/border, rather than
     * adding another wrapper view.
     */
    footer?: ReactNode
    /**
     * Extra style merged into the footer's padded wrapper (e.g. `gap`, a top
     * border). Avoids the need for a redundant inner wrapper view.
     */
    footerStyle?: StyleProp<ViewStyle>
    /**
     * Keyboard handling strategy.
     * - `'avoid'` (default): the scroll body auto-scrolls the focused input
     *   into view (`KeyboardAwareScrollView`) and the sticky footer rises with
     *   the keyboard (`KeyboardStickyView`).
     * - `'none'`: no keyboard handling (use for screens without inputs).
     */
    keyboard?: 'avoid' | 'none'
    /**
     * Extra style applied to the content container — the scroll content
     * container when `scroll` is `true`, or the fixed body when `false`.
     */
    contentContainerStyle?: StyleProp<ViewStyle>
    /** Extra style applied to the root flex:1 container. */
    style?: StyleProp<ViewStyle>
    testID?: string
}

/**
 * Canonical screen body: a keyboard-aware scrollable content area with an
 * optional sticky footer that rises with the keyboard, above the bottom safe
 * area.
 *
 * Safe-area ownership: PWScreen owns the BOTTOM inset (via `usePWScreenInsets`)
 * and the footer's safe area. It deliberately does NOT pad the TOP — the React
 * Navigation header owns the top safe area and the toolbar (the layout rules'
 * "Toolbar" / "TopSafeArea" zone). Screens without a native header should supply
 * their own toolbar/top inset rather than expecting PWScreen to add it.
 */
export const PWScreen = ({
    children,
    scroll = true,
    horizontalPadding = 'xl',
    footer,
    footerStyle,
    keyboard = 'avoid',
    contentContainerStyle,
    style,
    testID,
}: PWScreenProps) => {
    const { theme } = useTheme()
    const { bottomInset, isInTabNavigator } = usePWScreenInsets()
    const isKeyboardVisible = useKeyboardState(state => state.isVisible)
    const navigation = useContext(NavigationContext)
    const [footerHeight, setFooterHeight] = useState(0)
    const styles = useStyles({
        horizontalPadding,
        bottomInset,
        hasFooter: footer !== undefined,
    })

    const keyboardEnabled = keyboard === 'avoid'

    // Dismiss the keyboard when navigating away from this screen so it
    // doesn't linger over the next screen during the transition.
    useEffect(() => {
        if (!navigation) return
        const unsubscribe = navigation.addListener('blur', () => {
            Keyboard.dismiss()
        })
        return unsubscribe
    }, [navigation])

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        setFooterHeight(event.nativeEvent.layout.height)
    }, [])

    const footerEdges =
        isInTabNavigator || isKeyboardVisible ? [] : (['bottom'] as const)

    const body = scroll ? (
        <KeyboardAwareScrollView
            style={styles.body}
            contentContainerStyle={[
                styles.scrollContent,
                contentContainerStyle,
            ]}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='interactive'
            enabled={keyboardEnabled}
            // Clear the sticky footer (plus a gap) so a focused input never
            // scrolls to rest behind it.
            bottomOffset={footerHeight + theme.spacing.lg}
        >
            {children}
        </KeyboardAwareScrollView>
    ) : (
        <PWView style={[styles.fixedBody, contentContainerStyle]}>
            {children}
        </PWView>
    )

    const renderedFooter =
        footer === undefined ? null : (
            <KeyboardStickyView enabled={keyboardEnabled}>
                <SafeAreaView edges={footerEdges}>
                    <PWView
                        style={[styles.footer, footerStyle]}
                        onLayout={handleFooterLayout}
                    >
                        {footer}
                    </PWView>
                </SafeAreaView>
            </KeyboardStickyView>
        )

    return (
        <PWView
            style={[styles.root, style]}
            {...getTestProps(testID)}
        >
            {body}
            {renderedFooter}
        </PWView>
    )
}
