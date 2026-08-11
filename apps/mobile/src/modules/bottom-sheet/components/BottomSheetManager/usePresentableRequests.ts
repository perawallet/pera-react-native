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

import { useEffect, useMemo, useRef } from 'react'
import { useBottomSheetStore } from '../../store/bottomSheetStore'
import type { InternalRequest } from '../../types'

/**
 * The slice of the sheet stack the manager may render right now.
 *
 * While `isPresentationHeld` (set by the app-lock guard), NEW requests are
 * held here — a sheet presented under the lock overlay surfaces the instant
 * the PIN is accepted, which read as "entered my PIN, then the TX appeared"
 * in the field (PERA-4743). Holding at the manager covers every sheet at
 * once, so drivers (dApp signing, multisig, FAQ, …) don't need per-driver
 * gates.
 *
 * Two deliberate asymmetries:
 * - A sheet that has already painted stays mounted when the hold re-engages —
 *   the lock overlay hides it, and dismissing it would churn gorhom's modal
 *   stack for nothing.
 * - Only presentation is held. The stack and dismissal stay live, so a
 *   request dismissed while held (e.g. its sign request expired) leaves the
 *   stack and never presents.
 */
export const usePresentableRequests = (): InternalRequest[] => {
    const requests = useBottomSheetStore(s => s.requests)
    const isPresentationHeld = useBottomSheetStore(s => s.isPresentationHeld)
    // Ids that have painted at least once (recorded post-render, so a request
    // arriving in the same commit the hold engages is correctly held).
    const presentedIdsRef = useRef<Set<string>>(new Set())

    const presentable = useMemo(() => {
        if (!isPresentationHeld) return requests
        return requests.filter(request =>
            presentedIdsRef.current.has(request.id),
        )
    }, [requests, isPresentationHeld])

    useEffect(() => {
        // Prune ids that left the stack so the set stays bounded.
        const liveIds = new Set(requests.map(request => request.id))
        for (const id of presentedIdsRef.current) {
            if (!liveIds.has(id)) presentedIdsRef.current.delete(id)
        }
        for (const request of presentable) {
            presentedIdsRef.current.add(request.id)
        }
    }, [requests, presentable])

    return presentable
}
