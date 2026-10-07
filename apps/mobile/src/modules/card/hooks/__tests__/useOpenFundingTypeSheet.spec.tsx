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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CardEvent } from '@analytics'

const { mockRequest, mockTrackEvent } = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockTrackEvent: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequest,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

vi.mock('../../components/SelectFundingTypeSheet', () => ({
    SelectFundingTypeSheet: () => null,
}))

import { SelectFundingTypeSheet } from '../../components/SelectFundingTypeSheet'
import { useOpenFundingTypeSheet } from '../useOpenFundingTypeSheet'

describe('useOpenFundingTypeSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('tracks the tap and opens the Select Funding Type sheet', () => {
        const { result } = renderHook(() => useOpenFundingTypeSheet())

        result.current()

        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.HomeFundingType)
        expect(mockRequest).toHaveBeenCalledTimes(1)
        const [{ contents, options }] = mockRequest.mock.calls[0]
        expect(contents.type).toBe(SelectFundingTypeSheet)
        expect(options).toEqual({ size: 'auto', enablePanDownToClose: true })
    })
})
