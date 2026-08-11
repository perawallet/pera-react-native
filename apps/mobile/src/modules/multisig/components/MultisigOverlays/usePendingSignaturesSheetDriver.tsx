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

import React, { useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { PendingSignaturesContent } from '../PendingSignaturesContent'

/**
 * Presents the multisig pending-signatures sheet whenever the store holds a
 * sign request id. The multisig analogue of `useSignRequestDriver`.
 *
 * No app-lock gate here: BottomSheetManager holds every sheet's presentation
 * while the lock overlay is up (PERA-4743), so requesting while locked is
 * safe — the sheet paints only after unlock.
 */
export const usePendingSignaturesSheetDriver = () => {
    const signRequestId = usePendingSignaturesSheetStore(
        state => state.signRequestId,
    )
    const closeSheet = usePendingSignaturesSheetStore(state => state.closeSheet)
    const { request: requestBottomSheet } = useBottomSheet()
    // Track open-state, not the id, so a signRequestId change while the sheet
    // is open re-renders its content instead of stacking a second sheet.
    const isSheetOpenRef = useRef(false)

    useEffect(() => {
        if (!signRequestId) return
        if (isSheetOpenRef.current) return
        isSheetOpenRef.current = true
        void (async () => {
            await requestBottomSheet<void>({
                contents: <PendingSignaturesContent />,
                options: {
                    // Fixed snap point, not 'auto': the signers list is
                    // `flex: 1` (0 natural height), so 'auto' would collapse
                    // the sheet to header + footer.
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            // Dismissed — clear the open flag and the id; the next
            // openSheet() re-fires this effect with a fresh value.
            isSheetOpenRef.current = false
            closeSheet()
        })()
    }, [signRequestId, requestBottomSheet, closeSheet])
}
