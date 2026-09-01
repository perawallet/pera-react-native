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

// Stub for `react-native-keyboard-controller`: the published package ships
// untranspiled JSX/TS that vitest can't parse, so route tests through these.

import React from 'react'
// lanekeep-ignore-next-line pera/no-primitive-rn-components reason: stub standing in for a third-party component must render the primitive it replaces
import { ScrollView, View } from 'react-native'

import type { ReactNode } from 'react'
import type {
    ScrollViewProps,
    StyleProp,
    ViewProps,
    ViewStyle,
} from 'react-native'

type Children = { children?: ReactNode }

export const KeyboardProvider = ({ children }: Children) => <>{children}</>

export type KeyboardAwareScrollViewProps = ScrollViewProps & {
    bottomOffset?: number
    extraKeyboardSpace?: number
    disableScrollOnKeyboardHide?: boolean
    enabled?: boolean
    children?: ReactNode
}

export const KeyboardAwareScrollView = ({
    children,
    style,
    contentContainerStyle,
    ...rest
}: KeyboardAwareScrollViewProps) => (
    <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...rest}
    >
        {children}
    </ScrollView>
)

export type KeyboardStickyViewProps = ViewProps & {
    offset?: { closed?: number; opened?: number }
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

export const KeyboardStickyView = ({
    children,
    style,
}: KeyboardStickyViewProps) => <View style={style}>{children}</View>

export type KeyboardAvoidingViewProps = ViewProps & {
    behavior?: 'padding' | 'height' | 'position'
    enabled?: boolean
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

export const KeyboardAvoidingView = ({
    children,
    style,
}: KeyboardAvoidingViewProps) => (
    <View
        style={style}
        testID='keyboard-avoiding-view'
    >
        {children}
    </View>
)

export const KeyboardController = {
    setInputMode: () => {},
    setDefaultMode: () => {},
    dismiss: () => Promise.resolve(),
}

export const useKeyboardAnimation = () => ({
    height: { value: 0 },
    progress: { value: 0 },
})

export const useReanimatedKeyboardAnimation = () => ({
    height: { value: 0 },
    progress: { value: 0 },
})

export const useKeyboardHandler = () => {}

export const useKeyboardContext = () => ({ enabled: true })

const KEYBOARD_STATE = {
    isVisible: false,
    height: 0,
    target: -1,
    type: 0,
    appearance: 'default',
}

export const useKeyboardState = <T = typeof KEYBOARD_STATE,>(
    selector?: (state: typeof KEYBOARD_STATE) => T,
) => (selector ? selector(KEYBOARD_STATE) : (KEYBOARD_STATE as unknown as T))

export const OverKeyboardView = ({ children }: Children) => <>{children}</>
export const KeyboardToolbar = () => null
export const KeyboardExtender = ({ children }: Children) => <>{children}</>
