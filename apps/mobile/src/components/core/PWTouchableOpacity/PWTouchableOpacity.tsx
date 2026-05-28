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

import { useCallback } from 'react'
import {
    Keyboard,
    TouchableOpacity,
    type GestureResponderEvent,
    type TouchableOpacityProps,
} from 'react-native'
import { getTestProps } from '@utils/test-id-helper'

export type PWTouchableOpacityProps = {
    /** Dismiss keyboard after press (default true). */
    dismissKeyboardOnPress?: boolean
} & TouchableOpacityProps

const DEFAULT_ACTIVE_OPACITY = 0.8

export const PWTouchableOpacity = ({
    children,
    activeOpacity,
    testID,
    onPress,
    dismissKeyboardOnPress = true,
    ...rest
}: PWTouchableOpacityProps) => {
    // onPress before Keyboard.dismiss — bottom-sheet open races if reversed.
    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            onPress?.(event)
            if (dismissKeyboardOnPress) {
                Keyboard.dismiss()
            }
        },
        [onPress, dismissKeyboardOnPress],
    )

    return (
        <TouchableOpacity
            {...getTestProps(testID)}
            {...rest}
            onPress={onPress ? handlePress : undefined}
            activeOpacity={activeOpacity ?? DEFAULT_ACTIVE_OPACITY}
        >
            {children}
        </TouchableOpacity>
    )
}
