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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'
import { useExpandableAssetGroup } from '../useExpandableAssetGroup'

describe('useExpandableAssetGroup', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders members only while expanded when nothing has changed', () => {
        const collapsed = renderHook(() =>
            useExpandableAssetGroup({ isExpanded: false }),
        )
        const expanded = renderHook(() =>
            useExpandableAssetGroup({ isExpanded: true }),
        )

        expect(collapsed.result.current.shouldRenderMembers).toBe(false)
        expect(expanded.result.current.shouldRenderMembers).toBe(true)
    })

    it('mounts members as soon as the group expands', () => {
        const { result, rerender } = renderHook(
            ({ isExpanded }) => useExpandableAssetGroup({ isExpanded }),
            { initialProps: { isExpanded: false } },
        )

        rerender({ isExpanded: true })

        expect(result.current.shouldRenderMembers).toBe(true)
    })

    it('keeps members through the collapse animation, then drops them', () => {
        const { result, rerender } = renderHook(
            ({ isExpanded }) => useExpandableAssetGroup({ isExpanded }),
            { initialProps: { isExpanded: true } },
        )

        rerender({ isExpanded: false })
        expect(result.current.shouldRenderMembers).toBe(true)

        act(() => {
            vi.advanceTimersByTime(EXPANDABLE_PANEL_ANIMATION_DURATION)
        })
        expect(result.current.shouldRenderMembers).toBe(false)
    })

    it('keeps members when the group re-expands mid-collapse', () => {
        const { result, rerender } = renderHook(
            ({ isExpanded }) => useExpandableAssetGroup({ isExpanded }),
            { initialProps: { isExpanded: true } },
        )

        rerender({ isExpanded: false })
        rerender({ isExpanded: true })
        act(() => {
            vi.advanceTimersByTime(EXPANDABLE_PANEL_ANIMATION_DURATION)
        })

        expect(result.current.shouldRenderMembers).toBe(true)
    })
})
