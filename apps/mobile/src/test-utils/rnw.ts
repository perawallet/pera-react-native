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

import { act, fireEvent } from '@testing-library/react'
import { DOUBLE_PRESS_GUARD_MS } from '@components/core/PWTouchableOpacity/PWTouchableOpacity'

// react-native-web renders pressables as <div>s and reports `disabled` through
// aria-disabled, so a DOM `.disabled` read is always undefined on them.
export const isElementDisabled = (element: Element): boolean =>
    element.getAttribute('aria-disabled') === 'true' ||
    (element as HTMLButtonElement).disabled === true

// Pressables likewise render as focusable <div>s rather than <button>s, and
// only carry role="button" when the component sets an accessibilityRole.
const PRESSABLE_SELECTOR = 'button, [role="button"], [tabindex]'

export const closestPressable = (element: Element): HTMLElement | null =>
    element.closest<HTMLElement>(PRESSABLE_SELECTOR)

export const getAllPressables = (root: ParentNode = document.body) =>
    Array.from(root.querySelectorAll<HTMLElement>(PRESSABLE_SELECTOR))

// Rows and sheets are pressables too, so a label is matched to the innermost
// pressable holding it rather than the first ancestor that does.
export const queryPressableByText = (text: string): HTMLElement | null => {
    const matches = getAllPressables().filter(element =>
        (element.textContent ?? '').includes(text),
    )
    return (
        matches.find(
            element =>
                !matches.some(
                    other => other !== element && element.contains(other),
                ),
        ) ?? null
    )
}

// PWInput tags its error text `${testID}-error`; react-native-elements always
// renders that node, so an empty one means no error is showing.
export const getInputErrorMessage = (input: Element): string | null => {
    const testID = input.getAttribute('data-testid')
    if (!testID) return null
    const error = document.querySelector(`[data-testid="${testID}-error"]`)
    return error?.textContent || null
}

// react-native-web fires onLongPress from a held press (450ms by default), not
// from a context-menu event.
const LONG_PRESS_HOLD_MS = 500

export const longPress = async (element: Element): Promise<void> => {
    fireEvent.mouseDown(element)
    await act(
        () =>
            new Promise<void>(resolve =>
                setTimeout(resolve, LONG_PRESS_HOLD_MS),
            ),
    )
    fireEvent.mouseUp(element)
}

// PWTouchableOpacity swallows a second press inside its double-press guard, so
// a flow that presses the same (re-rendered) button twice must wait it out.
export const waitPastDoublePressGuard = (): Promise<void> =>
    act(
        () =>
            new Promise<void>(resolve =>
                setTimeout(resolve, DOUBLE_PRESS_GUARD_MS + 10),
            ),
    )

// react-native-web puts a Switch's testID on its wrapper; the checkbox that
// holds the state (and takes the click) is inside it.
export const getSwitchControl = (element: Element): HTMLInputElement => {
    const control = element.matches('input')
        ? element
        : element.querySelector('input[role="switch"]')
    if (!control) throw new Error('No switch control inside element')
    return control as HTMLInputElement
}
