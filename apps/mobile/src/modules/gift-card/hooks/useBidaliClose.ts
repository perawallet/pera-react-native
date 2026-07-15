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
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useBidali } from './useBidali'

/**
 * Close handler for the Bidali sheet's screens. Dismisses *this* sheet directly
 * through its own bottom-sheet context rather than a shared store callback, so
 * the close button always dismisses the sheet the user is looking at — even if
 * more than one Bidali sheet is ever open at once. Also clears the Bidali store
 * so the next open starts fresh.
 */
export const useBidaliClose = (): (() => void) => {
    const { reset } = useBidali()
    const { dismiss } = useBottomSheetResult<void>()

    return useCallback(() => {
        reset()
        dismiss()
    }, [reset, dismiss])
}
