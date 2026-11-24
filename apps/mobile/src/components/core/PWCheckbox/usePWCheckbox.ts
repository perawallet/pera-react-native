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

import { useCallback } from 'react'
import type { AccessibilityActionEvent, ViewProps } from 'react-native'

import { getCheckboxAccessibilityProps } from '@utils/test-id-helper'

type CheckboxAccessibilityProps = Pick<
    ViewProps,
    | 'accessible'
    | 'accessibilityRole'
    | 'accessibilityLabel'
    | 'aria-checked'
    | 'aria-disabled'
    | 'accessibilityActions'
    | 'onAccessibilityAction'
    | 'onAccessibilityTap'
>

type UsePWCheckboxParams = {
    isChecked: boolean
    isDisabled: boolean
    isLabelInteractive: boolean
    accessibilityLabel?: string
    onPress: () => void
}

export type UsePWCheckboxResult = {
    rowAccessibilityProps: CheckboxAccessibilityProps
    boxAccessibilityProps: CheckboxAccessibilityProps
}

const ACTIVATE_ACTIONS = [{ name: 'activate' }]

export const usePWCheckbox = ({
    isChecked,
    isDisabled,
    isLabelInteractive,
    accessibilityLabel,
    onPress,
}: UsePWCheckboxParams): UsePWCheckboxResult => {
    const handleActivate = useCallback(() => {
        if (!isDisabled) onPress()
    }, [isDisabled, onPress])

    const handleAccessibilityAction = useCallback(
        (event: AccessibilityActionEvent) => {
            if (event.nativeEvent.actionName === 'activate') handleActivate()
        },
        [handleActivate],
    )

    const checkboxProps = getCheckboxAccessibilityProps(isChecked, isDisabled)

    if (!isLabelInteractive) {
        return {
            rowAccessibilityProps: checkboxProps,
            boxAccessibilityProps: {},
        }
    }

    return {
        // An accessible row is one VoiceOver element, which would bury the
        // label's link, so the box carries the checkbox instead.
        rowAccessibilityProps: { accessible: false },
        boxAccessibilityProps: {
            ...checkboxProps,
            accessible: true,
            accessibilityLabel,
            // The box takes no touches, so a screen reader's double tap is
            // wired by hand: iOS sends onAccessibilityTap, Android `activate`.
            onAccessibilityTap: handleActivate,
            accessibilityActions: ACTIVATE_ACTIONS,
            onAccessibilityAction: handleAccessibilityAction,
        },
    }
}
