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

import { useContext, useEffect } from 'react'
import { Keyboard } from 'react-native'
import {
    KeyboardAvoidingView,
    useKeyboardState,
} from 'react-native-keyboard-controller'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContext } from '@react-navigation/native'
import { getTestProps } from '@utils/test-id-helper'
import { PWView } from '../PWView'
import { usePWScreenInsets } from './usePWScreenInsets'
import { useStyles, type HorizontalPaddingMode } from './styles'

import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type PWScreenProps = {
    /** Sticky top zone, above the body. Most screens leave this to the
     * navigation header and omit it. */
    header?: ReactNode
    /** Scrollable body — the only required zone. */
    body: ReactNode
    /** Sticky bottom zone, pinned above the keyboard when it opens. */
    footer?: ReactNode
    /** Body scroll behavior. `'auto'` (default) wraps the body in a scroll
     * container that scrolls only when its content overflows the screen.
     * `'never'` renders a fixed, full-height body — use it when the body owns
     * its own scrolling (e.g. a `PWFlatList`) or is a fixed layout that must
     * not scroll. */
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
    body,
    footer,
    scroll = 'auto',
    horizontalPadding = 'xl',
    style,
    testID,
}: PWScreenProps) => {
    const { bottomInset, isInTabNavigator } = usePWScreenInsets()
    const isKeyboardVisible = useKeyboardState(state => state.isVisible)
    const navigation = useContext(NavigationContext)
    const styles = useStyles({
        horizontalPadding,
        bottomInset,
        hasFooter: footer != null,
    })

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
        isInTabNavigator || isKeyboardVisible ? [] : (['bottom'] as const)

    const renderedHeader =
        header == null ? null : <PWView style={styles.header}>{header}</PWView>

    const renderedBody =
        scroll === 'auto' ? (
            <ScrollView
                style={styles.body}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps='handled'
                keyboardDismissMode='interactive'
            >
                {body}
            </ScrollView>
        ) : (
            <PWView style={styles.fixedBody}>{body}</PWView>
        )

    const renderedFooter =
        footer == null ? null : (
            <SafeAreaView edges={footerEdges}>
                <PWView style={styles.footer}>{footer}</PWView>
            </SafeAreaView>
        )

    // `behavior='padding'` shrinks the body to the space the keyboard leaves,
    // so the footer pins just above it and the body scrolls only when its
    // content can't fit — instead of reserving keyboard-height ghost padding.
    return (
        <PWView
            style={[styles.root, style]}
            {...getTestProps(testID)}
        >
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior='padding'
            >
                {renderedHeader}
                {renderedBody}
                {renderedFooter}
            </KeyboardAvoidingView>
        </PWView>
    )
}
