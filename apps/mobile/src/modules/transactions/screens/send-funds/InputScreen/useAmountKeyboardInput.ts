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

import type { RefObject } from 'react'
import type { View } from 'react-native'

export type UseAmountKeyboardInputParams = {
    /** Same contract as the on-screen keypad: a digit or '.', undefined deletes. */
    onKey: (key?: string) => void
    /**
     * Gets the raw clipboard text, unchecked; the handler must validate it
     * (useInputScreen's handlePaste ignores anything that isn't a plain amount).
     */
    onPaste: (text: string) => void
    onSubmit: () => void
    /** Focused once rendered, so Tab walks on from the amount to the controls below. */
    amountRef: RefObject<View | null>
    /**
     * True while the amount is on screen and this screen is focused. The send
     * stack keeps it mounted under later steps, which must not receive its keys.
     */
    isActive: boolean
}

/** Native no-op: phones enter amounts on the on-screen keypad only. */
export const useAmountKeyboardInput = (
    _params: UseAmountKeyboardInputParams,
): void => {}
