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

import { useCallback, useLayoutEffect } from 'react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useBidali } from '../../hooks/useBidali'

/**
 * Wires the Bidali internal store's `onClose` to the host bottom sheet so
 * inner screens (intro/account-selection/webview) can dismiss the sheet
 * via `useBidali().onClose?.()`. Also resets the Bidali store when the
 * sheet is dismissed.
 */
export const useBidaliContent = (): void => {
    const { setOnClose, reset } = useBidali()
    const { dismiss } = useBottomSheetResult<void>()

    const handleClose = useCallback(() => {
        reset()
        dismiss()
    }, [reset, dismiss])

    useLayoutEffect(() => {
        setOnClose(handleClose)
    }, [handleClose, setOnClose])
}
