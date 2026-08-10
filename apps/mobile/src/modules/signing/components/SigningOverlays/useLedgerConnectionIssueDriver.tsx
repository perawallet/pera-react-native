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
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { LedgerConnectionIssueContent } from '../LedgerConnectionIssueContent'
import { useLedgerSigningContent } from '../LedgerSigningContent/useLedgerSigningContent'

/**
 * Watches the hardware-signing content hook for the troubleshooting sheet
 * visibility flag and shows the LedgerConnectionIssueContent via the
 * centralized bottom sheet manager.
 *
 * `onCloseTroubleshooting()` is only invoked when the user dismisses the
 * sheet (pan-down or backdrop press). The effect cleanup sets
 * `cancelled = true` before driver-initiated dismissals, so the post-await
 * branch is skipped in that path — important because in the BLE-class
 * auto-open flow `onCloseTroubleshooting` rejects the active sign request
 * (it is not safely idempotent).
 */
export const useLedgerConnectionIssueDriver = () => {
    const { isTroubleshootingVisible, onCloseTroubleshooting } =
        useLedgerSigningContent()
    // BLE errors only fire while the active sign request is in flight, so the
    // head of the pending queue identifies the request the troubleshooting
    // sheet is bound to. Mirrors the previous `useHardwareSigning().requestId`
    // behavior without a parallel store.
    const { pendingSignRequests } = useSigningRequest()
    const requestId = pendingSignRequests[0]?.id ?? null
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (!isTroubleshootingVisible) {
            if (openIdRef.current) {
                dismiss(openIdRef.current)
                openIdRef.current = null
            }
            return
        }
        if (openIdRef.current) return

        const sheetId = requestId
            ? `ledger-troubleshooting:${requestId}`
            : 'ledger-troubleshooting'
        openIdRef.current = sheetId

        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                id: sheetId,
                contents: <LedgerConnectionIssueContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    enableCloseOnBackdropPress: true,
                },
            })
            if (cancelled) return
            if (openIdRef.current === sheetId) {
                openIdRef.current = null
            }
            onCloseTroubleshooting()
        })()
        return () => {
            cancelled = true
        }
    }, [
        isTroubleshootingVisible,
        requestId,
        onCloseTroubleshooting,
        requestBottomSheet,
        dismiss,
    ])
}
