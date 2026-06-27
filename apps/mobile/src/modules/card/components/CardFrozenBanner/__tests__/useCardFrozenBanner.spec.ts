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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    status: 'FROZEN' as string | null,
    isUnfreezing: false,
    request: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStatusQuery: () => ({
            data: mocks.status == null ? null : { status: mocks.status },
        }),
        useIsCardUnfreezing: () => mocks.isUnfreezing,
    }
})

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

import { useCardFrozenBanner } from '../useCardFrozenBanner'

describe('useCardFrozenBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.status = 'FROZEN'
        mocks.isUnfreezing = false
    })

    it('is frozen only when the card status is FROZEN', () => {
        const { result, rerender } = renderHook(() => useCardFrozenBanner())
        expect(result.current.isFrozen).toBe(true)

        mocks.status = 'ACTIVE'
        rerender()
        expect(result.current.isFrozen).toBe(false)

        mocks.status = null
        rerender()
        expect(result.current.isFrozen).toBe(false)
    })

    it('opens the unfreeze confirmation sheet on reactivate', () => {
        const { result } = renderHook(() => useCardFrozenBanner())

        act(() => {
            result.current.onReactivate()
        })

        expect(mocks.request).toHaveBeenCalledTimes(1)
    })

    it('reflects the in-flight unfreeze via isReactivating', () => {
        mocks.isUnfreezing = true

        const { result } = renderHook(() => useCardFrozenBanner())
        expect(result.current.isReactivating).toBe(true)
    })
})
