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
    useHardwareSigning,
    useLastTransportResult,
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
 * Watches the signing store for a completed request and shows the
 * "signing completed" sheet via the centralized bottom sheet manager.
 *
 * Clearing `lastCompletedRequest` after dismissal advances the store
 * state so the sheet doesn't keep reopening.
 */
const useSigningCompletedDriver = () => {
    const { lastCompletedRequest, clearLastCompletedRequest } =
        useSigningRequest()
    const lastTransportResult = useLastTransportResult()
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
        // Multisig propose (including sync-flow handoffs from WC / webview /
        // deeplink) is also surfaced by PendingSignaturesContent. Showing
        // the "Transaction Processing" sheet on top would race the
        // pending-signatures sheet that useMultisigProposeListener opens.
        // The lifecycle sets lastTransportResult BEFORE lastCompletedRequest
        // (useSigningActorLifecycle.ts: setLastTransportResultRef then
        // setLastCompletedRequestRef), so by the time this effect runs the
        // transport result reflects the same completion.
        if (lastTransportResult?.type === 'proposed') {
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
    }, [
        lastCompletedRequest,
        lastTransportResult,
        requestBottomSheet,
        clearLastCompletedRequest,
    ])
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
    const { requestId } = useHardwareSigning()
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
