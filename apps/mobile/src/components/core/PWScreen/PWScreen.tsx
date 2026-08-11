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

import {
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'
import {
    Keyboard,
    Platform,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native'
import {
    KeyboardAwareScrollView,
    KeyboardAvoidingView,
    KeyboardStickyView,
    useKeyboardState,
} from 'react-native-keyboard-controller'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@rneui/themed'
import { NavigationContext } from '@react-navigation/native'
import { PWView } from '../PWView'
import { PWInBottomSheetContext } from '../PWBottomSheet/inSheetContext'
import { PWScreenNestedContext } from './nestedContext'
import { usePWScreenInsets } from './usePWScreenInsets'
import { useStyles, type HorizontalPaddingMode } from './styles'

export type PWScreenProps = {
    /** Sticky top zone, above the body. Most screens leave this to the
     * navigation header and omit it. */
    header?: ReactNode
    /** Scrollable body. Omit when the screen is header + footer only. */
    children?: ReactNode
    /** Sticky bottom zone, pinned above the keyboard when it opens. */
    footer?: ReactNode
    /** Body scroll behavior. `'auto'` (default) wraps the body in a scroll
     * container that scrolls only when its content overflows the screen.
     * `'never'` renders a fixed, full-height body — use it when the body owns
     * its own scrolling (e.g. a `PWFlatList`) or is a fixed layout that must
     * not scroll. Forms with text inputs should use `'auto'`, which scrolls the
     * focused field clear of the keyboard. */
    scroll?: 'auto' | 'never'
    horizontalPadding?: HorizontalPaddingMode
    style?: StyleProp<ViewStyle>
    testID?: string
}

/**
 * Screen layout with three stacked zones: an optional sticky `header`, a
 * scrollable `body`, and an optional sticky `footer`. The footer pins above
 * the keyboard and the body shrinks to the space the keyboard leaves, so the
 * body scrolls only when its content can't fit. Mirrors `PWSheetLayout`'s
 * `header`/`body`/`footer` slots for sheets.
 */
export const PWScreen = ({
    header,
    children,
    footer,
    scroll = 'auto',
    horizontalPadding = 'xl',
    style,
    testID,
}: PWScreenProps) => {
    const { theme } = useTheme()
    const { bottomInset, isBottomHandledOutside } = usePWScreenInsets()
    const isKeyboardVisible = useKeyboardState(state => state.isVisible)
    const navigation = useContext(NavigationContext)
    // Inside a sheet a plain/keyboard-aware ScrollView silently fails to scroll
    // because the sheet's pan gesture owns the touch — swap in gorhom's.
    const isInSheet = useContext(PWInBottomSheetContext)
    const styles = useStyles({
        horizontalPadding,
        bottomInset,
        hasFooter: footer != null,
        isKeyboardVisible,
    })
    const [footerHeight, setFooterHeight] = useState(0)

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        setFooterHeight(event.nativeEvent.layout.height)
    }, [])

    // Dismiss the keyboard on navigating away so it doesn't linger over the
    // next screen during the transition.
    useEffect(() => {
        if (!navigation) return
        const unsubscribe = navigation.addListener('blur', () => {
            Keyboard.dismiss()
        })
        return unsubscribe
    }, [navigation])

    // When the keyboard lifts the footer, drop its safe-area edge so it sits
    // flush above the keyboard instead of leaving a home-indicator gap.
    const footerEdges =
        isBottomHandledOutside || isKeyboardVisible ? [] : (['bottom'] as const)

    const renderedHeader =
        header == null ? null : <PWView style={styles.header}>{header}</PWView>

    const renderedBody =
        children == null ? (
            // Header + footer only: a flex filler absorbs the free space so the
            // footer sticks to the bottom (no body to push it down otherwise).
            <PWView style={styles.fixedBody} />
        ) : scroll === 'auto' ? (
            isInSheet ? (
                // gorhom's scrollable cooperates with the sheet pan gesture; the
                // sheet owns keyboard handling, so no KeyboardAwareScrollView here.
                <BottomSheetScrollView
                    style={styles.body}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps='handled'
                >
                    {children}
                </BottomSheetScrollView>
            ) : (
                <KeyboardAwareScrollView
                    style={styles.body}
                    contentContainerStyle={styles.scrollContent}
                    bottomOffset={
                        footer != null ? footerHeight + theme.spacing.md : 0
                    }
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps='handled'
                    keyboardDismissMode='interactive'
                >
                    {children}
                </KeyboardAwareScrollView>
            )
        ) : (
            <PWView style={styles.fixedBody}>{children}</PWView>
        )

    const renderedScrollFooter =
        footer == null ? null : (
            <KeyboardStickyView>
                <SafeAreaView
                    edges={footerEdges}
                    onLayout={handleFooterLayout}
                    style={styles.footerSafeArea}
                >
                    <PWView style={styles.footer}>{footer}</PWView>
                </SafeAreaView>
            </KeyboardStickyView>
        )

    const renderedFixedFooter =
        footer == null ? null : (
            <SafeAreaView
                edges={footerEdges}
                style={styles.footerSafeArea}
            >
                <PWView style={styles.footer}>{footer}</PWView>
            </SafeAreaView>
        )

    if (scroll === 'auto') {
        // KeyboardAwareScrollView keeps the focused field visible; the sticky
        // footer rides the keyboard via KeyboardStickyView — no KAV needed.
        return (
            <PWScreenNestedContext.Provider value={true}>
                <PWView
                    style={[styles.root, style]}
                    testID={testID}
                >
                    {renderedHeader}
                    {renderedBody}
                    {renderedScrollFooter}
                </PWView>
            </PWScreenNestedContext.Provider>
        )
    }

    // scroll='never' renders a fixed body (it owns its own scrolling, e.g. a
    // PWFlatList). `behavior='padding'` shrinks the container as the keyboard
    // opens, lifting the fixed body and its footer above it.
    return (
        <PWScreenNestedContext.Provider value={true}>
            <PWView
                style={[styles.root, style]}
                testID={testID}
            >
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={
                        Platform.OS === 'ios' ? bottomInset : 0
                    }
                >
                    {renderedHeader}
                    {renderedBody}
                    {renderedFixedFooter}
                </KeyboardAvoidingView>
            </PWView>
        </PWScreenNestedContext.Provider>
    )
}
