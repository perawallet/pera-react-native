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

// Goes through platform-chrome's approval-client accessors: apps/mobile's
// oxlint forbids the ambient `chrome` global.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    getCurrentApproval,
    getPendingApproval,
    rejectApproval,
    resolveApproval,
    type PendingApproval,
} from '@perawallet/wallet-extension-platform-chrome'

type UseDappRequestResult = {
    requestId: string | null
    approval: PendingApproval | null
    isLoading: boolean
    approve: (addresses: string[]) => Promise<void>
    reject: () => Promise<void>
    /**
     * Set when a decision could not reach the bridge (MV3 evicted the service
     * worker and its pending map while the user deliberated). The window stays
     * open: the dApp was never answered, and closing would report a success.
     */
    deliveryError: boolean
}

const readRequestId = (): string | null =>
    new URLSearchParams(window.location.search).get('requestId')

export const useDappRequest = (): UseDappRequestResult => {
    const [requestId, setRequestId] = useState<string | null>(readRequestId)
    const [approval, setApproval] = useState<PendingApproval | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [deliveryError, setDeliveryError] = useState(false)
    // Set inside approve()/reject() so a window close after an explicit
    // decision doesn't send a redundant pagehide reject.
    const settledRef = useRef(false)

    useEffect(() => {
        const queryId = readRequestId()
        let cancelled = false
        const fetchApproval = queryId
            ? getPendingApproval(queryId)
            : getCurrentApproval()
        void fetchApproval.then(res => {
            if (cancelled) return
            setApproval(res)
            if (queryId) {
                setRequestId(queryId)
            } else if (res) {
                setRequestId(res.requestId)
            }
            setIsLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!requestId) return
        const handlePageHide = (): void => {
            if (settledRef.current) return
            settledRef.current = true
            // Best-effort on the way out: the bridge may already be gone, and
            // an unhandled rejection during unload helps nobody.
            void rejectApproval(requestId).catch(() => undefined)
        }
        window.addEventListener('pagehide', handlePageHide)
        return () => {
            window.removeEventListener('pagehide', handlePageHide)
        }
    }, [requestId])

    const approve = useCallback(
        async (addresses: string[]): Promise<void> => {
            if (!requestId) return
            settledRef.current = true
            try {
                await resolveApproval(requestId, addresses)
            } catch {
                // Undelivered: leave the window open and say so. Re-arm the
                // pagehide reject too — the request is still unsettled from
                // the bridge's point of view if it ever comes back.
                settledRef.current = false
                setDeliveryError(true)
                return
            }
            window.close()
        },
        [requestId],
    )

    const reject = useCallback(async (): Promise<void> => {
        if (!requestId) return
        settledRef.current = true
        try {
            await rejectApproval(requestId)
        } catch {
            // Unlike approve, closing is still the right move: the user asked
            // to dismiss, there is nothing for them to act on, and the dApp
            // sees its own timeout rather than a fabricated approval.
        }
        window.close()
    }, [requestId])

    return { requestId, approval, isLoading, approve, reject, deliveryError }
}
