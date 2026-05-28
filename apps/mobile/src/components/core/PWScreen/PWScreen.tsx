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
    scroll?: boolean
    horizontalPadding?: HorizontalPaddingMode
    footer?: ReactNode
    footerStyle?: StyleProp<ViewStyle>
    keyboard?: 'avoid' | 'none'
    contentContainerStyle?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle>
    testID?: string
}

/**
 * Screen body with optional sticky footer. Owns the bottom safe-area inset only
 * (top inset is the navigation header's job).
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
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
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
