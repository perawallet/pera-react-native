/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { useSwipeableAssetItem } from '../useSwipeableAssetItem'

const item = { assetId: '31566704' } as AccountHoldingsLiteRow

describe('useSwipeableAssetItem', () => {
    it('opts the row out when the swipe opens', () => {
        const onOptOut = vi.fn()
        const { result } = renderHook(() =>
            useSwipeableAssetItem({ item, onPress: vi.fn(), onOptOut }),
        )

        act(() => result.current.handleSwipeOpen())

        expect(onOptOut).toHaveBeenCalledWith(item)
    })

    it('presses the row without letting the press bubble up', () => {
        const onPress = vi.fn()
        const stopPropagation = vi.fn()
        const { result } = renderHook(() =>
            useSwipeableAssetItem({ item, onPress, onOptOut: vi.fn() }),
        )

        act(() =>
            result.current.handlePress({
                stopPropagation,
            } as never),
        )

        expect(stopPropagation).toHaveBeenCalled()
        expect(onPress).toHaveBeenCalledWith(item)
    })
})
