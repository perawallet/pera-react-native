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
import { logger } from '@perawallet/wallet-core-shared'
import { useBottomSheet, useBottomSheetStore } from '@modules/bottom-sheet'
import {
    isInteractiveSource,
    useSigningPipeline,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { SignRequestContent } from '../SignRequestContent'

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
 * Hardware-visibility gate: while a hardware child is signing for a
 * DIFFERENT request (e.g. a headless Ledger send parked on the device
 * prompt), no new sheet is opened — the interactive request stays queued
 * and presents once the hardware sign settles. Opening it earlier would
 * stack a review sheet over the Ledger overlay. A sheet already open for
 * the SAME request stays mounted beneath the hardware overlay (dismissing
 * it mid-sign collapses gorhom's modal stack and tears the overlay down).
 *
 * The sheet preserves the legacy presentation: `size='lg'`, gestures
 * and backdrop press disabled — signing must complete via the UI
 * controls.
 */
export const useSignRequestDriver = () => {
    const { pendingSignRequests, currentRequest } = useSigningRequest()
    // Queue-head pipeline: only the head request has a live actor, so this
    // is the hardware-signing activity signal for the whole queue.
    const { resolved } = useSigningPipeline()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    // BottomSheetManager can be unmounted during route-tree swaps
    // (migration/onboarding gates); requesting a sheet then rejects. Gate on
    // the host count so the pending request re-presents when a host mounts
    // instead of wedging in the queue with no sheet and no dApp response.
    const hostCount = useBottomSheetStore(s => s.hostCount)
    const openIdRef = useRef<string | null>(null)

    const nextRequest = pendingSignRequests.find(r =>
        isInteractiveSource(r.sourceType),
    )

    const isHardwareBusyForOtherRequest =
        resolved?.activeChild?.kind === 'hardware' &&
        !!nextRequest &&
        currentRequest?.id !== nextRequest.id

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

        // No sheet host mounted: any previously "open" sheet was already
        // force-settled by the unregistering host, so drop the bookkeeping
        // and wait — the 0→1 hostCount transition re-runs this effect and
        // re-opens the sheet for the still-pending request.
        if (hostCount === 0) {
            openIdRef.current = null
            return
        }
        if (openIdRef.current === sheetId) return

        // No app-lock gate here: BottomSheetManager holds every sheet's
        // presentation while the lock overlay is up (PERA-4743), so
        // requesting while locked is safe — the sheet paints after unlock.

        // A hardware sign is in flight for a different request — leave the
        // interactive request queued. The effect re-runs when the queue or
        // the pipeline's hardware child changes, so it opens after settle.
        if (isHardwareBusyForOtherRequest) return

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
                        size: 'modal',
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
    }, [
        nextRequest,
        isHardwareBusyForOtherRequest,
        hostCount,
        requestBottomSheet,
        dismiss,
    ])
}
