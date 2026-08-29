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

import { useCallback, useRef } from 'react'
import {
    Keyboard,
    TouchableOpacity,
    type GestureResponderEvent,
    type TouchableOpacityProps,
} from 'react-native'
import { getTestProps } from '@utils/test-id-helper'

export type PWTouchableOpacityProps = {
    dismissKeyboardOnPress?: boolean
    /** Opt out of the double-press guard for rapid-tap surfaces (e.g. numpad). */
    allowRapidPress?: boolean
} & TouchableOpacityProps

const DEFAULT_ACTIVE_OPACITY = 0.8

// Swallow repeat presses within this window so a double-tap can't fire onPress twice.
const DOUBLE_PRESS_GUARD_MS = 500

export const PWTouchableOpacity = ({
    children,
    activeOpacity,
    testID,
    onPress,
    dismissKeyboardOnPress = true,
    allowRapidPress = false,
    ...rest
}: PWTouchableOpacityProps) => {
    const lastPressAtRef = useRef(0)

    // onPress before Keyboard.dismiss — bottom-sheet open races if reversed.
    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            if (!allowRapidPress) {
                const now = Date.now()
                if (now - lastPressAtRef.current < DOUBLE_PRESS_GUARD_MS) return
                lastPressAtRef.current = now
            }
            onPress?.(event)
            if (dismissKeyboardOnPress) {
                Keyboard.dismiss()
            }
        },
        [onPress, dismissKeyboardOnPress, allowRapidPress],
    )

    return (
        <TouchableOpacity
            key={rest.disabled ? 'disabled' : 'enabled'}
            {...getTestProps(testID)}
            {...rest}
            onPress={onPress ? handlePress : undefined}
            activeOpacity={activeOpacity ?? DEFAULT_ACTIVE_OPACITY}
        >
            {children}
        </TouchableOpacity>
    )
}
