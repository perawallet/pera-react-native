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
import { useSecurityStore } from '@perawallet/wallet-core-security'
import { useBottomSheet } from '@modules/bottom-sheet'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { PendingSignaturesContent } from '../PendingSignaturesContent'

/**
 * Presents the multisig pending-signatures sheet whenever the store holds a
 * sign request id. The multisig analogue of `useSignRequestDriver`.
 */
export const usePendingSignaturesSheetDriver = () => {
    const signRequestId = usePendingSignaturesSheetStore(
        state => state.signRequestId,
    )
    const closeSheet = usePendingSignaturesSheetStore(state => state.closeSheet)
    const { request: requestBottomSheet } = useBottomSheet()
    // While AutoLockGuard's overlay covers the app, hold NEW presentations:
    // a sheet opened under the lock overlay surfaces the instant the PIN is
    // accepted, which read as "entered my PIN, then the TX appeared" in the
    // field (PERA-4743). The flag flip on unlock re-runs the effect.
    const isAppLockActive = useSecurityStore(s => s.isAppLockActive)
    // Track open-state, not the id, so a signRequestId change while the sheet
    // is open re-renders its content instead of stacking a second sheet.
    const isSheetOpenRef = useRef(false)

    useEffect(() => {
        if (!signRequestId) return
        if (isSheetOpenRef.current) return
        if (isAppLockActive) return
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
    }, [signRequestId, isAppLockActive, requestBottomSheet, closeSheet])
}
