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
import { type Optional } from '@perawallet/wallet-core-shared'
import { useFeatureFlagOverrides } from '../useFeatureFlagOverrides'

const mockSetConfigOverride = vi.fn()
const mockConfigOverrides: Record<string, Optional<boolean>> = {}

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfigOverrides: () => ({
        configOverrides: mockConfigOverrides,
        setConfigOverride: mockSetConfigOverride,
    }),
    RemoteConfigKeys: {
        enable_pera_card: 'enable_pera_card',
        enable_motion_lock: 'enable_motion_lock',
        terms_version: 'terms_version',
        active_locales: 'active_locales',
        fee_warning_standard_fee: 'fee_warning_standard_fee',
    },
    RemoteConfigDefaults: {
        enable_pera_card: false, // boolean
        enable_motion_lock: true, // boolean
        terms_version: '1', // string
        active_locales: '', // string
        fee_warning_standard_fee: 0.001, // number
    },
}))

describe('useFeatureFlagOverrides', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.keys(mockConfigOverrides).forEach(key => {
            delete mockConfigOverrides[key]
        })
    })

    describe('toggleExpand', () => {
        it('sets override to false when key is not expanded', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.toggleExpand('test_flag')
            })

            expect(mockSetConfigOverride).toHaveBeenCalledWith(
                'test_flag',
                false,
            )
        })

        it('clears override when key is already expanded', () => {
            mockConfigOverrides['test_flag'] = false
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.toggleExpand('test_flag')
            })

            expect(mockSetConfigOverride).toHaveBeenCalledWith(
                'test_flag',
                null,
            )
        })

        it('derives expanded from configOverrides keys', () => {
            mockConfigOverrides['flag_a'] = true
            mockConfigOverrides['flag_b'] = false
            const { result } = renderHook(() => useFeatureFlagOverrides())

            expect(result.current.expanded).toEqual(['flag_a', 'flag_b'])
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

    describe('booleanFlagKeys', () => {
        it('includes only boolean-valued remote config flags', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            // String (terms_version) and number (fee_warning_standard_fee) flags
            // are excluded — this screen only renders boolean toggles.
            expect(result.current.booleanFlagKeys).toEqual([
                'enable_pera_card',
                'enable_motion_lock',
            ])
        })
    })

    describe('stringFlagKeys', () => {
        it('includes only string-valued remote config keys', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            // Booleans get toggles instead, and number-valued keys have no
            // editor at all — neither belongs in the text-field list.
            expect(result.current.stringFlagKeys).toEqual([
                'terms_version',
                'active_locales',
            ])
        })
    })

    describe('setStringOverride', () => {
        it('stores a non-empty value as the override', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.setStringOverride('active_locales', 'de,fr')
            })

            expect(mockSetConfigOverride).toHaveBeenCalledWith(
                'active_locales',
                'de,fr',
            )
        })

        it('clears the override when the field is emptied', () => {
            const { result } = renderHook(() => useFeatureFlagOverrides())

            act(() => {
                result.current.setStringOverride('active_locales', '')
            })

            expect(mockSetConfigOverride).toHaveBeenCalledWith(
                'active_locales',
                null,
            )
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
