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

import { useCallback, useContext, useRef } from 'react'
import {
    Keyboard,
    TouchableOpacity,
    type GestureResponderEvent,
    type TouchableOpacityProps,
} from 'react-native'
import {
    Pressable as GHPressable,
    type PressableProps as GHPressableProps,
} from 'react-native-gesture-handler'
import { getTestProps } from '@utils/test-id-helper'
import { PWInBottomSheetContext } from '../PWBottomSheet/inSheetContext'

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

    // Inside a sheet, RN's TouchableOpacity (JS responder system) competes with
    // the sheet's content pan gesture and its hit frame goes stale across the
    // open/close animation — taps land only near the center. gorhom requires a
    // gesture-handler pressable there; it hit-tests the live native view and
    // cooperates with the pan, so the full button stays tappable after reopen.
    const isInSheet = useContext(PWInBottomSheetContext)

    // onPress before Keyboard.dismiss — bottom-sheet open races if reversed.
    // The event is optional so this handler is assignable to both the RN and
    // gesture-handler touchable onPress signatures (the latter intersects with
    // a zero-arg form).
    const handlePress = useCallback(
        (event?: GestureResponderEvent) => {
            if (!allowRapidPress) {
                const now = Date.now()
                if (now - lastPressAtRef.current < DOUBLE_PRESS_GUARD_MS) return
                lastPressAtRef.current = now
            }
            if (event) {
                onPress?.(event)
            }
            if (dismissKeyboardOnPress) {
                Keyboard.dismiss()
            }
        },
        [onPress, dismissKeyboardOnPress, allowRapidPress],
    )

    if (isInSheet) {
        // gorhom's Pressable replaces the (deprecated) gesture-handler
        // touchables. It has no activeOpacity prop, so reproduce the dim via a
        // pressed-state style. RN and gorhom prop types diverge (event shape,
        // style-as-function), so cast the bag for this branch.
        const { style, ...pressableRest } = rest
        const sheetProps = {
            ...getTestProps(testID),
            ...pressableRest,
            onPress: onPress ? handlePress : undefined,
            style: ({ pressed }: { pressed: boolean }) => [
                style,
                pressed
                    ? { opacity: activeOpacity ?? DEFAULT_ACTIVE_OPACITY }
                    : null,
            ],
        }
        return (
            <GHPressable {...(sheetProps as unknown as GHPressableProps)}>
                {children}
            </GHPressable>
        )
    }

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
