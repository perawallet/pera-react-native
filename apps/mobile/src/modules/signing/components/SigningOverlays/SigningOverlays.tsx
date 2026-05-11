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
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { LedgerSigningOverlayContainer } from '../LedgerSigningOverlay'
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

    const nextRequest = pendingSignRequests.find(r => !r.headless)

    useEffect(() => {
        const sheetId = nextRequest ? `sign-request:${nextRequest.id}` : null

        // No pending non-headless request — dismiss any open sheet so the
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

export const SigningOverlays = () => {
    useSignRequestDriver()
    useSigningCompletedDriver()
    useTransactionRequestFAQDriver()

    return <LedgerSigningOverlayContainer />
}
