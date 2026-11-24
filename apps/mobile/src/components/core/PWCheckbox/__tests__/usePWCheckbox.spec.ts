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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AccessibilityActionEvent } from 'react-native'
import { usePWCheckbox } from '../usePWCheckbox'

const activateEvent = (actionName: string) =>
    ({ nativeEvent: { actionName } }) as AccessibilityActionEvent

describe('usePWCheckbox', () => {
    it('makes the row the checkbox when the label has no pressable', () => {
        const { result } = renderHook(() =>
            usePWCheckbox({
                isChecked: true,
                isDisabled: false,
                isLabelInteractive: false,
                onPress: vi.fn(),
            }),
        )

        expect(result.current.rowAccessibilityProps).toEqual({
            accessibilityRole: 'checkbox',
            'aria-checked': true,
            'aria-disabled': false,
        })
        expect(result.current.boxAccessibilityProps).toEqual({})
    })

    it('moves the checkbox onto the box, named by its label, when the label holds a link', () => {
        const { result } = renderHook(() =>
            usePWCheckbox({
                isChecked: false,
                isDisabled: false,
                isLabelInteractive: true,
                accessibilityLabel: 'I accept the Terms & Conditions.',
                onPress: vi.fn(),
            }),
        )

        expect(result.current.rowAccessibilityProps).toEqual({
            accessible: false,
        })
        expect(result.current.boxAccessibilityProps).toMatchObject({
            accessible: true,
            accessibilityRole: 'checkbox',
            accessibilityLabel: 'I accept the Terms & Conditions.',
            'aria-checked': false,
            'aria-disabled': false,
        })
    })

    it('toggles from a screen reader activation of the box on both platforms', () => {
        const onPress = vi.fn()
        const { result } = renderHook(() =>
            usePWCheckbox({
                isChecked: false,
                isDisabled: false,
                isLabelInteractive: true,
                accessibilityLabel: 'Accept',
                onPress,
            }),
        )
        const box = result.current.boxAccessibilityProps

        box.onAccessibilityTap?.()
        box.onAccessibilityAction?.(activateEvent('activate'))
        box.onAccessibilityAction?.(activateEvent('magicTap'))

        expect(onPress).toHaveBeenCalledTimes(2)
    })

    it('ignores a screen reader activation while disabled', () => {
        const onPress = vi.fn()
        const { result } = renderHook(() =>
            usePWCheckbox({
                isChecked: false,
                isDisabled: true,
                isLabelInteractive: true,
                accessibilityLabel: 'Accept',
                onPress,
            }),
        )

        result.current.boxAccessibilityProps.onAccessibilityTap?.()
        result.current.boxAccessibilityProps.onAccessibilityAction?.(
            activateEvent('activate'),
        )

        expect(onPress).not.toHaveBeenCalled()
    })
})
