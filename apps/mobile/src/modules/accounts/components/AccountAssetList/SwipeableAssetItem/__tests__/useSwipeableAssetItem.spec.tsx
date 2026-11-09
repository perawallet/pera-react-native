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

import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { useSwipeableAssetItem } from '../useSwipeableAssetItem'

const item = { assetId: '31566704' } as AccountHoldingsLiteRow

describe('useSwipeableAssetItem', () => {
    it.each(['optOut', 'hide'] as const)(
        "runs the row's %s action when the swipe opens",
        swipeAction => {
            const onSwipeAction = vi.fn()
            const { result } = renderHook(() =>
                useSwipeableAssetItem({
                    item,
                    swipeAction,
                    onPress: vi.fn(),
                    onSwipeAction,
                }),
            )

            act(() => result.current.handleSwipeOpen())

            expect(onSwipeAction).toHaveBeenCalledWith(item, swipeAction)
        },
    )

    it('runs nothing for a row with no swipe action', () => {
        const onSwipeAction = vi.fn()
        const { result } = renderHook(() =>
            useSwipeableAssetItem({
                item,
                swipeAction: null,
                onPress: vi.fn(),
                onSwipeAction,
            }),
        )

        act(() => result.current.handleSwipeOpen())

        expect(onSwipeAction).not.toHaveBeenCalled()
    })

    it('presses the row without letting the press bubble up', () => {
        const onPress = vi.fn()
        const stopPropagation = vi.fn()
        const { result } = renderHook(() =>
            useSwipeableAssetItem({
                item,
                swipeAction: 'optOut',
                onPress,
                onSwipeAction: vi.fn(),
            }),
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
