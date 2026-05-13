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

import React, { useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useHardwareSigning,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { LedgerConnectionIssueContent } from '../LedgerConnectionIssueContent'
import { LedgerSigningContent } from '../LedgerSigningContent'
import { useLedgerSigningContent } from '../LedgerSigningContent/useLedgerSigningContent'
import { SignRequestContent } from '../SignRequestContent'
import { SigningCompletedContent } from '../SigningCompletedContent'
import { TransactionRequestFAQContent } from '../TransactionRequestFAQContent'

/**
 * Watches the signing queue for the next non-headless sign request and
 * shows the request sheet via the centralized bottom sheet manager.
 *
 * Headless requests run signing in the background (e.g. swap drives its
 * own confirmation UI) so they're skipped here. When the queue advances
 * to a different request id while a sheet is already open, the previous
 * sheet is dismissed via the manager so the new one opens cleanly.
 *
 * Skipped while a hardware-signing session is in flight — the
 * LedgerSigningContent sheet (or the troubleshooting sheet) takes over,
 * matching the native flow where the transaction-review sheet is gone
 * by the time device UI appears.
 *
 * The sheet preserves the legacy presentation: `size='lg'`, gestures and
 * backdrop press disabled — signing must complete via the UI controls.
 */
const useSignRequestDriver = () => {
    const { pendingSignRequests } = useSigningRequest()
    const { status: hardwareStatus } = useHardwareSigning()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    // 'idle' means no hardware signing session. Anything else means the
    // hardware overlay (or the troubleshooting sheet) is the primary
    // surface, so this sheet stays out of the way.
    const isHardwareSigningInFlight = hardwareStatus !== 'idle'

    const nextRequest = pendingSignRequests.find(r => !r.headless)

    useEffect(() => {
        const sheetId =
            !isHardwareSigningInFlight && nextRequest ? nextRequest.id : null

        if (!sheetId) {
            if (openIdRef.current) {
                dismiss(openIdRef.current)
                openIdRef.current = null
            }
            return
        }
        if (openIdRef.current === sheetId) return

        if (openIdRef.current) {
            dismiss(openIdRef.current)
        }
        openIdRef.current = sheetId

        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                id: sheetId,
                contents: <SignRequestContent request={nextRequest!} />,
                options: {
                    size: 'lg',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            })
            if (cancelled) return
            if (openIdRef.current === sheetId) {
                openIdRef.current = null
            }
        })()
        return () => {
            cancelled = true
        }
    }, [nextRequest, isHardwareSigningInFlight, requestBottomSheet, dismiss])
}

/**
 * Watches the signing store for a completed request and shows the
 * "signing completed" sheet via the centralized bottom sheet manager.
 *
 * Clearing `lastCompletedRequest` after dismissal advances the store
 * state so the sheet doesn't keep reopening.
 */
const useSigningCompletedDriver = () => {
    const { lastCompletedRequest, clearLastCompletedRequest } =
        useSigningRequest()
    const { request: requestBottomSheet } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (!lastCompletedRequest) return
        // Multisig cosign completions are surfaced by PendingSignaturesContent
        // (live signer status + threshold progress). The generic "Transaction
        // Processing" copy here is misleading for a cosign (the user added a
        // signature; they didn't send a transaction), so suppress it and
        // clear the success state so the next request can render.
        if (lastCompletedRequest.sourceType === 'multisig-cosign') {
            clearLastCompletedRequest()
            return
        }
        if (openIdRef.current === lastCompletedRequest.id) return
        openIdRef.current = lastCompletedRequest.id
        const isTransaction = lastCompletedRequest.type === 'transactions'
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: (
                    <SigningCompletedContent isTransaction={isTransaction} />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            openIdRef.current = null
            clearLastCompletedRequest()
        })()
        return () => {
            cancelled = true
        }
    }, [lastCompletedRequest, requestBottomSheet, clearLastCompletedRequest])
}

const FAQ_SEEN_KEY = 'hasSeenTransactionRequestFAQ'

/**
 * Watches for the first transaction sign request and shows the FAQ sheet
 * via the centralized bottom sheet manager — once per device.
 */
const useTransactionRequestFAQDriver = () => {
    const { pendingSignRequests } = useSigningRequest()
    const { getPreference, setPreference } = usePreferences()
    const { request: requestBottomSheet } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        const next = pendingSignRequests.find(
            r =>
                !r.headless &&
                r.type === 'transactions' &&
                r.sourceType !== 'multisig-cosign',
        )
        if (!next) return
        if (openIdRef.current === next.id) return
        if (getPreference(FAQ_SEEN_KEY)) return
        openIdRef.current = next.id
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: <TransactionRequestFAQContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            setPreference(FAQ_SEEN_KEY, true)
            openIdRef.current = null
        })()
        return () => {
            cancelled = true
        }
    }, [pendingSignRequests, getPreference, setPreference, requestBottomSheet])
}

/**
 * Watches the hardware-wallet signing store for an active session and
 * shows the LedgerSigningContent sheet via the centralized bottom sheet
 * manager.
 *
 * The sheet visibility is gated by the content hook's `isVisible`
 * derivation, which excludes the silent BLE-scan phase and the BLE-class
 * error path (where the troubleshooting sheet is the primary surface).
 *
 * Presentation matches the legacy overlay: `size='auto'`, gestures and
 * backdrop press disabled — signing must complete via the UI controls.
 */
const useLedgerSigningDriver = () => {
    const { requestId } = useHardwareSigning()
    const { isVisible } = useLedgerSigningContent()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        const sheetId = isVisible && requestId ? requestId : null

        if (!sheetId) {
            if (openIdRef.current) {
                dismiss(openIdRef.current)
                openIdRef.current = null
            }
            return
        }
        if (openIdRef.current === sheetId) return

        if (openIdRef.current) {
            dismiss(openIdRef.current)
        }
        openIdRef.current = sheetId

        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                id: sheetId,
                contents: <LedgerSigningContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            })
            if (cancelled) return
            if (openIdRef.current === sheetId) {
                openIdRef.current = null
            }
        })()
        return () => {
            cancelled = true
        }
    }, [isVisible, requestId, requestBottomSheet, dismiss])
}

/**
 * Watches the hardware-signing content hook for the troubleshooting sheet
 * visibility flag and shows the LedgerConnectionIssueContent via the
 * centralized bottom sheet manager.
 *
 * User dismissal (Close button, pan-down, backdrop press) resolves the
 * awaited request and the driver then calls onCloseTroubleshooting to
 * notify the signing state machine. Driver-initiated dismiss (when
 * isTroubleshootingVisible flips back to false) takes the same code path,
 * which is safe because onCloseTroubleshooting is idempotent — flipping
 * an already-false flag to false is a no-op.
 */
const useLedgerConnectionIssueDriver = () => {
    const { isTroubleshootingVisible, onCloseTroubleshooting } =
        useLedgerSigningContent()
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

        const sheetId = `ledger-troubleshooting-${Date.now()}`
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
        onCloseTroubleshooting,
        requestBottomSheet,
        dismiss,
    ])
}

export const SigningOverlays = () => {
    useSignRequestDriver()
    useSigningCompletedDriver()
    useTransactionRequestFAQDriver()
    useLedgerSigningDriver()
    useLedgerConnectionIssueDriver()

    return null
}
