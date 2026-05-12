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
import {
    useHardwareSigning,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { LedgerSigningContent } from '../LedgerSigningContent'
import { SignRequestContent } from '../SignRequestContent'
import { SigningCompletedContent } from '../SigningCompletedContent'
import { TransactionRequestFAQContent } from '../TransactionRequestFAQContent'

/**
 * Watches the signing queue for the next interactive sign request and
 * shows the request sheet via the centralized bottom sheet manager.
 *
 * Headless requests (the default — `interactive` omitted or false) run
 * signing in the background and the originating screen drives its own
 * confirmation UI, so they're skipped here. When the queue advances
 * to a different request id while a sheet is already open, the previous
 * sheet is dismissed via the manager so the new one opens cleanly — this
 * preserves the visual cue the old `deferToNextCycle` close-and-reopen
 * dance was reaching for, without manual scheduling.
 *
 * The sheet preserves the legacy presentation: `size='lg'`, gestures and
 * backdrop press disabled — signing must complete via the UI controls.
 */
const useSignRequestDriver = () => {
    const { pendingSignRequests } = useSigningRequest()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    const nextRequest = pendingSignRequests.find(r => r.interactive === true)

    useEffect(() => {
        const sheetId = nextRequest ? nextRequest.id : null

        // No pending interactive request — dismiss any open sheet so the
        // user isn't left looking at stale request data after the queue
        // drains (e.g. WC tx signing completes).
        if (!sheetId) {
            if (openIdRef.current) {
                dismiss(openIdRef.current)
                openIdRef.current = null
            }
            return
        }
        // Already showing this exact request — no-op.
        if (openIdRef.current === sheetId) return

        // A different request is now at the head of the queue. Dismiss the
        // previous sheet (if any) so the new one opens cleanly.
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
                r.interactive === true &&
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
 * The sheet is keyed by the active sign request id so that a new request
 * starting before the previous overlay has fully torn down (e.g. retry
 * after a terminal transition) swaps to a fresh sheet rather than reusing
 * stale content. Cancel/retry are wired inside the content via
 * `useLedgerSigningContent`; cancel resets the store, which flips
 * `isActive` to false and lets this driver dismiss the sheet.
 *
 * Presentation matches the legacy overlay: `size='lg'`, gestures and
 * backdrop press disabled — signing must complete via the UI controls.
 */
const useLedgerSigningDriver = () => {
    const { isActive, requestId } = useHardwareSigning()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    useEffect(() => {
        const sheetId = isActive && requestId ? requestId : null

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
    }, [isActive, requestId, requestBottomSheet, dismiss])
}

export const SigningOverlays = () => {
    useSignRequestDriver()
    useSigningCompletedDriver()
    useTransactionRequestFAQDriver()
    useLedgerSigningDriver()

    return null
}
