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

import type { ComponentType } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { PWTouchableOpacity, PWView } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import type { SearchableListSearchProps } from '@components/SearchableList'

const NOOP = () => {}

export type SearchInputTriggerProps = {
    /** Opens the real search experience (navigate, reveal overlay, etc.). */
    onPress: () => void
    /** Mirrors the active query when the trigger doubles as a display. */
    value?: string
    placeholder?: string
    testID?: string
    /** Styles the inner, non-interactive display (e.g. hide behind an overlay). */
    displayStyle?: StyleProp<ViewStyle>
    /** Render a custom input display; defaults to SearchInput. */
    SearchInputComponent?: ComponentType<SearchableListSearchProps>
    /** Off for flows that focus a real input on press (keyboard would dismiss). */
    dismissKeyboardOnPress?: boolean
    accessibilityLabel?: string
    accessibilityElementsHidden?: boolean
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants'
}

/**
 * A search field that behaves like a button: it renders a real search input as
 * a non-interactive display and forwards taps to `onPress`. Lets a single tap
 * open the search experience (navigate to a search screen, reveal a focusable
 * overlay) without the user first focusing an inert field.
 */
export const SearchInputTrigger = ({
    onPress,
    value,
    placeholder,
    testID,
    displayStyle,
    SearchInputComponent = SearchInput,
    dismissKeyboardOnPress,
    accessibilityLabel,
    accessibilityElementsHidden,
    importantForAccessibility,
}: SearchInputTriggerProps) => {
    return (
        <PWTouchableOpacity
            onPress={onPress}
            testID={testID}
            accessibilityRole='button'
            accessibilityLabel={accessibilityLabel}
            accessibilityElementsHidden={accessibilityElementsHidden}
            importantForAccessibility={importantForAccessibility}
            dismissKeyboardOnPress={dismissKeyboardOnPress}
        >
            <PWView
                pointerEvents='none'
                style={displayStyle}
            >
                <SearchInputComponent
                    value={value}
                    placeholder={placeholder}
                    onFocus={NOOP}
                    onChangeText={NOOP}
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
