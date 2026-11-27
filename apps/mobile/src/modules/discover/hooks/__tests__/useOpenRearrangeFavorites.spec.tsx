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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenRearrangeFavorites } from '../useOpenRearrangeFavorites'

const request = vi.fn()
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual('@modules/bottom-sheet')),
    useBottomSheet: () => ({ request }),
}))

describe('useOpenRearrangeFavorites', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens Rearrange as a full sheet without pan gestures', () => {
        const { result } = renderHook(() => useOpenRearrangeFavorites())

        result.current()

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    size: 'modal',
                    enablePanDownToClose: false,
                    enableContentPanningGesture: false,
                    autoCreateContainer: false,
                }),
            }),
        )
    })
})
