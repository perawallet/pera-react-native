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
import { logger } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    isInteractiveSource,
    useSigningEvent,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { LedgerConnectionIssueContent } from '../LedgerConnectionIssueContent'
import { useLedgerSigningContent } from '../LedgerSigningContent/useLedgerSigningContent'
import { SignRequestContent } from '../SignRequestContent'
import { SigningCompletedContent } from '../SigningCompletedContent'
import { TransactionRequestFAQContent } from '../TransactionRequestFAQContent'
import { useLedgerSigningDriver } from './useLedgerSigningDriver'

/**
 * Watches the signing queue for the next interactive sign request and
 * shows the request sheet via the centralized bottom sheet manager.
 *
 * A request is "interactive" if its `sourceType` belongs to
 * `INTERACTIVE_SOURCES` (WalletConnect, deeplinks, in-app web view,
 * multisig cosign, ARC-60, gift card). Headless requests (internal
 * send/swap flows where the originating screen owns the confirmation
 * UI) are skipped here. When the queue advances to a different
 * request id while a sheet is already open, the previous sheet is
 * dismissed via the manager so the new one opens cleanly.
 *
 * Skipped while a hardware-signing overlay is actually visible — i.e.
 * when status is 'awaitingApproval', 'signing', or 'error'. During the
 * silent BLE-scan phase ('searching') no hardware UI is rendered yet, so
 * this sheet stays mounted to avoid a jarring blank-screen gap between
 * the sign-request sheet disappearing and the Ledger sheet appearing.
 *
 * The sheet preserves the legacy presentation: `size='lg'`, gestures
 * and backdrop press disabled — signing must complete via the UI
 * controls.
 */
const useSignRequestDriver = () => {
    const { pendingSignRequests } = useSigningRequest()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    const nextRequest = pendingSignRequests.find(r =>
        isInteractiveSource(r.sourceType),
    )

    useEffect(() => {
        // Keep the sign-request sheet mounted for as long as its request is
        // pending — including while the Ledger overlay is shown on top during
        // hardware signing. Previously this sheet was dismissed (and then
        // `remove`d once its close animation finished) the moment hardware
        // signing started; because the Ledger overlay is presented on top of
        // it, removing the underlying sheet mid-sign collapsed gorhom's modal
        // stack and tore the Ledger overlay down (the "vanishes when the
        // device prompts" bug). Leaving it mounted underneath (hidden behind
        // the overlay's backdrop) keeps the stack intact; it's dismissed only
        // when the request actually leaves the queue.
        const sheetId = nextRequest ? nextRequest.id : null

        // No pending interactive request (or hardware overlay is showing) —
        // dismiss any open sheet so the user isn't left looking at stale
        // request data after the queue drains (e.g. WC tx signing completes).
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
            try {
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
            } catch (err) {
                logger.error('[signing/overlay] sheet promise rejected', {
                    sheetId,
                    err,
                })
            }
            if (cancelled) return
            if (openIdRef.current === sheetId) {
                openIdRef.current = null
            }
        })()
        return () => {
            cancelled = true
        }
    }, [nextRequest, requestBottomSheet, dismiss])
}

/**
 * Subscribes to the signing event bus and shows the "signing completed"
 * sheet via the centralized bottom sheet manager when a request completes
 * with a non-proposed transport result.
 *
 * Multisig cosign and multisig propose completions are surfaced by
 * PendingSignaturesContent — skip the generic sheet for those.
 */
const useSigningCompletedDriver = () => {
    const { request: requestBottomSheet } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useSigningEvent(
        event => event.type === 'completed',
        event => {
            if (event.type !== 'completed') return
            const req = event.request

            // Multisig cosign + multisig propose are surfaced by
            // PendingSignaturesContent — skip the generic completion sheet.
            if (req.sourceType === 'multisig-cosign') return
            if (event.result.type === 'proposed') return

            if (openIdRef.current === req.id) return
            openIdRef.current = req.id

            const isTransaction = req.type === 'transactions'
            void (async () => {
                await requestBottomSheet<void>({
                    contents: (
                        <SigningCompletedContent
                            isTransaction={isTransaction}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (openIdRef.current === req.id) {
                    openIdRef.current = null
                }
            })()
        },
    )
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
                isInteractiveSource(r.sourceType) &&
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
 * Watches the hardware-signing content hook for the troubleshooting sheet
 * visibility flag and shows the LedgerConnectionIssueContent via the
 * centralized bottom sheet manager.
 *
 * `onCloseTroubleshooting()` is only invoked when the user dismisses the
 * sheet (Close button, pan-down, backdrop press). The effect cleanup sets
 * `cancelled = true` before driver-initiated dismissals, so the post-await
 * branch is skipped in that path — important because in the BLE-class
 * auto-open flow `onCloseTroubleshooting` rejects the active sign request
 * (it is not safely idempotent).
 */
const useLedgerConnectionIssueDriver = () => {
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

export const SigningOverlays = () => {
    useSignRequestDriver()
    useSigningCompletedDriver()
    useTransactionRequestFAQDriver()
    useLedgerSigningDriver()
    useLedgerConnectionIssueDriver()

    return null
}
