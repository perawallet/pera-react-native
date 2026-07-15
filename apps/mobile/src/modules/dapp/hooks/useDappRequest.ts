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

// Approval-window side of the dapp approval bridge (Task 4): reads the
// requestId the SW put on the popup's URL (ApprovalWindowBridge.openEnable),
// fetches the pending approval over runtime messaging, and resolves it by
// posting resolve-approval/reject-approval back to the same bridge. Goes
// through platform-chrome's approval-client accessors rather than the
// ambient `chrome` global directly — apps/mobile's oxlint config forbids
// that (no-restricted-globals).
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
}

const readRequestId = (): string | null =>
    new URLSearchParams(window.location.search).get('requestId')

export const useDappRequest = (): UseDappRequestResult => {
    const [requestId, setRequestId] = useState<string | null>(readRequestId)
    const [approval, setApproval] = useState<PendingApproval | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    // Guards the pagehide reject: set inside approve()/reject() so a window
    // close after an explicit decision doesn't fire a redundant reject. Not
    // an issue if it did (the SW's finish() is single-settle/idempotent) but
    // there's no reason to send the extra message.
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
            void rejectApproval(requestId)
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
            await resolveApproval(requestId, addresses)
            window.close()
        },
        [requestId],
    )

    const reject = useCallback(async (): Promise<void> => {
        if (!requestId) return
        settledRef.current = true
        await rejectApproval(requestId)
        window.close()
    }, [requestId])

    return { requestId, approval, isLoading, approve, reject }
}
