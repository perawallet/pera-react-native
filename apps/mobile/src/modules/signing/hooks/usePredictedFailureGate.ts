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

import { useCallback } from 'react'
import { create } from 'zustand'
import { registerStore, type Optional } from '@perawallet/wallet-core-shared'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { createAcknowledgementStore } from './createAcknowledgementStore'

type PredictedFailureFlagState = {
    /** The request a predicted-failure warning is on screen for. */
    flaggedRequestId: Optional<string>
}

type PredictedFailureFlagActions = {
    setFlaggedRequestId: (id: Optional<string>) => void
    resetState: () => void
}

export const usePredictedFailureFlagStore = create<
    PredictedFailureFlagState & PredictedFailureFlagActions
>()(set => ({
    flaggedRequestId: undefined,
    setFlaggedRequestId: id => set({ flaggedRequestId: id }),
    resetState: () => set({ flaggedRequestId: undefined }),
}))

registerStore({
    name: 'predicted-failure-flag-store',
    clearStorage: () => {},
    resetState: () => usePredictedFailureFlagStore.getState().resetState(),
})

export const usePredictedFailureAcknowledgementStore =
    createAcknowledgementStore('predicted-failure-acknowledgement-store')

export type UsePredictedFailureGateResult = {
    isFlagged: boolean
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    /** A predicted failure is on screen and the user hasn't acknowledged it. */
    isConfirmBlocked: boolean
}

/**
 * Whether Confirm still waits on the user acknowledging a predicted failure.
 * The chain's review sets the flag, so the shared buttons never read a
 * chain's simulation.
 */
export const usePredictedFailureGate = (): UsePredictedFailureGateResult => {
    const { currentRequest } = useSigningRequest()
    const flaggedRequestId = usePredictedFailureFlagStore(
        state => state.flaggedRequestId,
    )
    const acknowledgedRequestId = usePredictedFailureAcknowledgementStore(
        state => state.acknowledgedRequestId,
    )
    const setAcknowledgedRequestId = usePredictedFailureAcknowledgementStore(
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
