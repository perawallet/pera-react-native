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

import { useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useMultisigProposeListener } from '../../hooks/useMultisigProposeListener'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { PendingSignaturesContent } from '../PendingSignaturesContent'

export const MultisigOverlays = () => {
    useMultisigProposeListener()

    const signRequestId = usePendingSignaturesSheetStore(
        state => state.signRequestId,
    )
    const closeSheet = usePendingSignaturesSheetStore(state => state.closeSheet)
    const { request: requestBottomSheet } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (!signRequestId) return
        if (openIdRef.current === signRequestId) return
        openIdRef.current = signRequestId
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: <PendingSignaturesContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            openIdRef.current = null
            // Ensure the store is cleared if the sheet was dismissed via gesture
            // or backdrop press rather than handleClose.
            closeSheet()
        })()
        return () => {
            cancelled = true
        }
    }, [signRequestId, requestBottomSheet, closeSheet])

    return null
}
