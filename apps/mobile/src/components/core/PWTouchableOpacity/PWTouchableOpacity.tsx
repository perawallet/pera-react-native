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

import { useCallback, useLayoutEffect, useRef } from 'react'
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
export const DOUBLE_PRESS_GUARD_MS = 500

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

    // react-native-web hands the touchable a new handler only in a passive
    // effect, so a press landing before it would run the previous render's
    // onPress with stale state. Updated at commit, read at press time.
    const onPressRef = useRef(onPress)
    useLayoutEffect(() => {
        onPressRef.current = onPress
    })

    // onPress before Keyboard.dismiss — bottom-sheet open races if reversed.
    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            if (!allowRapidPress) {
                const now = Date.now()
                if (now - lastPressAtRef.current < DOUBLE_PRESS_GUARD_MS) return
                lastPressAtRef.current = now
            }
            onPressRef.current?.(event)
            if (dismissKeyboardOnPress) {
                Keyboard.dismiss()
            }
        },
        [dismissKeyboardOnPress, allowRapidPress],
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
