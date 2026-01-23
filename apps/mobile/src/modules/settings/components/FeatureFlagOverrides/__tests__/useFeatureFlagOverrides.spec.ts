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

/*
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
     https://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeatureFlagOverrides } from '../useFeatureFlagOverrides'

const mockSetConfigOverride = vi.fn()
const mockConfigOverrides: Record<string, boolean | undefined> = {}

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useRemoteConfigOverrides: () => ({
        configOverrides: mockConfigOverrides,
        setConfigOverride: mockSetConfigOverride,
    }),
}))

describe('useFeatureFlagOverrides', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.keys(mockConfigOverrides).forEach(key => {
            delete mockConfigOverrides[key]
        })
    })

    describe('toggleExpand', () => {
        it('adds key to expanded array when not already expanded', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.toggleExpand('test_flag')
            })

            expect(result.current.expanded).toContain('test_flag')
        })

        it('removes key from expanded array and clears override when already expanded', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            // First expand
            act(() => {
                result.current.toggleExpand('test_flag')
            })

            // Then collapse
            act(() => {
                result.current.toggleExpand('test_flag')
            })

            expect(result.current.expanded).not.toContain('test_flag')
            expect(mockSetConfigOverride).toHaveBeenCalledWith(
                'test_flag',
                null,
            )
        })
    })

    describe('toggleOverride', () => {
        it('sets override to true when value is undefined', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.toggleOverride('new_flag')
            })

            expect(mockSetConfigOverride).toHaveBeenCalledWith('new_flag', true)
        })

        it('sets override to false when value is already set', () => {
            mockConfigOverrides['existing_flag'] = true
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.toggleOverride('existing_flag')
            })

            expect(mockSetConfigOverride).toHaveBeenCalledWith(
                'existing_flag',
                false,
            )
        })
    })

    describe('prettifyKey', () => {
        it('replaces underscores with spaces and capitalizes words', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(result.current.prettifyKey('feature_flag_name')).toBe(
                'Feature Flag Name',
            )
        })

        it('handles single word keys', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(result.current.prettifyKey('feature')).toBe('Feature')
        })

        it('handles empty string', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(result.current.prettifyKey('')).toBe('')
        })
    })

    describe('return values', () => {
        it('returns configOverrides from the mock', () => {
            mockConfigOverrides['some_flag'] = true
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(result.current.configOverrides).toEqual({ some_flag: true })
        })

        it('returns setConfigOverride function', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(typeof result.current.setConfigOverride).toBe('function')
        })

        it('returns empty expanded array initially', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(result.current.expanded).toEqual([])
        })
    })
})
