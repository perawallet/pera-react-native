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

import { createContext, useContext, useEffect } from 'react'
import { useIsFocused } from '@react-navigation/native'
import type { SharedValue } from 'react-native-reanimated'
import type { Nullable } from '@perawallet/wallet-core-shared'

import type { AccountPickerKind } from './useAccountPickers'

export type AccountDrawerContextValue = {
    isOpen: boolean
    openDrawer: () => void
    closeDrawer: () => void
    /**
     * 0-1 open progress. Published so a pager on the screen can drive the
     * drawer from its own pan instead of running a competing one — see PWPager.
     */
    progress: SharedValue<number>
    /** How the focused screen wants the account list shaped. */
    pickerKind: AccountPickerKind
    publishPickerKind: (kind: AccountPickerKind) => void
}

export const AccountDrawerContext =
    createContext<Nullable<AccountDrawerContextValue>>(null)

/**
 * `null` wherever no drawer is mounted — which is how the account-selection
 * trigger decides between opening the drawer and falling back to the bottom
 * sheet, rather than each call site knowing where it sits.
 */
export const useAccountDrawerControls =
    (): Nullable<AccountDrawerContextValue> => useContext(AccountDrawerContext)

/**
 * Declares how this screen wants the shared drawer's list shaped. Gated on
 * focus because tab screens stay mounted after you switch away, and an
 * unfocused screen must not restyle the drawer for the one on display.
 */
export const useAccountDrawerPickerKind = (kind: AccountPickerKind): void => {
    const controls = useAccountDrawerControls()
    const isFocused = useIsFocused()
    const publish = controls?.publishPickerKind

    useEffect(() => {
        if (!publish || !isFocused) return
        publish(kind)
    }, [publish, isFocused, kind])
}
