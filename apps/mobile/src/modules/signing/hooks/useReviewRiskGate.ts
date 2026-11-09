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

import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { registerStore, type Optional } from '@perawallet/wallet-core-shared'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { createAcknowledgementStore } from './createAcknowledgementStore'

export const useReviewRiskAcknowledgementStore = createAcknowledgementStore(
    'review-risk-acknowledgement-store',
)

type ReviewRiskFlagState = {
    /** The request a high-risk review warning is on screen for. */
    flaggedRequestId: Optional<string>
    seenRequestId: Optional<string>
    /** High-risk warning ids already on screen for `seenRequestId`, kept here so every banner instance agrees. */
    seenIds: readonly string[]
}

type ReviewRiskFlagActions = {
    setFlaggedRequestId: (id: Optional<string>) => void
    /**
     * Records the high-risk warning ids on screen. A tick only covers the warnings on
     * screen when it was given, so an id that is new for the request withdraws it.
     */
    noteHighRisk: (requestId: string, ids: readonly string[]) => void
    resetState: () => void
}

export const useReviewRiskFlagStore = create<
    ReviewRiskFlagState & ReviewRiskFlagActions
>()((set, get) => ({
    flaggedRequestId: undefined,
    seenRequestId: undefined,
    seenIds: [],
    setFlaggedRequestId: id => set({ flaggedRequestId: id }),
    noteHighRisk: (requestId, ids) => {
        const { seenRequestId, seenIds } = get()
        const known = seenRequestId === requestId ? seenIds : []
        const added = ids.filter(id => !known.includes(id))
        if (added.length > 0 || seenRequestId !== requestId) {
            set({
                seenRequestId: requestId,
                seenIds: [...known, ...added],
            })
        }
        if (added.length === 0) return
        const acknowledgement = useReviewRiskAcknowledgementStore.getState()
        if (acknowledgement.acknowledgedRequestId === requestId) {
            acknowledgement.setAcknowledgedRequestId(undefined)
        }
    },
    resetState: () =>
        set({
            flaggedRequestId: undefined,
            seenRequestId: undefined,
            seenIds: [],
        }),
}))

registerStore({
    name: 'review-risk-flag-store',
    clearStorage: () => {},
    resetState: () => useReviewRiskFlagStore.getState().resetState(),
})

export type UseReviewRiskGateResult = {
    isFlagged: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    /** A high-risk warning is on screen and the user hasn't acknowledged it. */
    isConfirmBlocked: boolean
}

/**
 * Whether Confirm still waits on the user acknowledging a high-risk review
 * warning. The chain's review sets the flag, so the shared buttons never read
 * a chain's simulation or fee.
 */
export const useReviewRiskGate = (): UseReviewRiskGateResult => {
    const { currentRequest } = useSigningRequest()
    const flaggedRequestId = useReviewRiskFlagStore(
        state => state.flaggedRequestId,
    )
    const acknowledgedRequestId = useReviewRiskAcknowledgementStore(
        state => state.acknowledgedRequestId,
    )
    const setAcknowledgedRequestId = useReviewRiskAcknowledgementStore(
        state => state.setAcknowledgedRequestId,
    )

    const requestId = currentRequest?.id
    const isFlagged = !!requestId && flaggedRequestId === requestId
    const isAcknowledged = !!requestId && acknowledgedRequestId === requestId
    const toggleAcknowledged = useCallback(() => {
        if (!requestId) return
        setAcknowledgedRequestId(isAcknowledged ? undefined : requestId)
    }, [requestId, isAcknowledged, setAcknowledgedRequestId])

    return {
        isFlagged,
        isAcknowledged,
        toggleAcknowledged,
        isConfirmBlocked: isFlagged && !isAcknowledged,
    }
}

/** Flags the current request while mounted with `isFlagged`, so Confirm waits on the acknowledgement. */
export const useFlagReviewRisk = (isFlagged: boolean): void => {
    const { currentRequest } = useSigningRequest()
    const requestId = currentRequest?.id
    const setFlaggedRequestId = useReviewRiskFlagStore(
        state => state.setFlaggedRequestId,
    )

    useEffect(() => {
        if (!requestId || !isFlagged) return
        setFlaggedRequestId(requestId)
        return () => {
            // A newer request may have flagged itself by now.
            if (
                useReviewRiskFlagStore.getState().flaggedRequestId === requestId
            ) {
                setFlaggedRequestId(undefined)
            }
        }
    }, [requestId, isFlagged, setFlaggedRequestId])
}
