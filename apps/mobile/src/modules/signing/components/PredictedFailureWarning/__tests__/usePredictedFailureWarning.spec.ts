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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    usePredictedFailureGate,
    usePredictedFailureAcknowledgementStore,
    usePredictedFailureFlagStore,
} from '../../../hooks/usePredictedFailureGate'
import { usePredictedFailureWarning } from '../usePredictedFailureWarning'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

const setRequest = (id: string) =>
    (useSigningRequest as Mock).mockReturnValue({ currentRequest: { id } })

const flagged = () => usePredictedFailureFlagStore.getState().flaggedRequestId

describe('usePredictedFailureWarning', () => {
    beforeEach(() => {
        usePredictedFailureFlagStore.getState().resetState()
        usePredictedFailureAcknowledgementStore.getState().resetState()
        setRequest('request-1')
    })

    it('flags the request while mounted and clears the flag on unmount', () => {
        const { unmount } = renderHook(() => usePredictedFailureWarning())
        expect(flagged()).toBe('request-1')

        unmount()

        expect(flagged()).toBeUndefined()
    })

    it('holds Confirm until the warning is acknowledged', () => {
        const warning = renderHook(() => usePredictedFailureWarning())
        const gate = renderHook(() => usePredictedFailureGate())
        expect(gate.result.current.isConfirmBlocked).toBe(true)

        act(() => warning.result.current.toggleAcknowledged())

        expect(warning.result.current.isAcknowledged).toBe(true)
        expect(gate.result.current.isConfirmBlocked).toBe(false)
    })

    it("leaves a newer request's flag alone when an older warning unmounts late", () => {
        const { unmount } = renderHook(() => usePredictedFailureWarning())
        act(() => {
            usePredictedFailureFlagStore
                .getState()
                .setFlaggedRequestId('request-2')
        })

        unmount()

        expect(flagged()).toBe('request-2')
    })
})
