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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const navigate = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({ navigate }),
    }
})

import { useSettingsDeveloperGalleryScreen } from '../useSettingsDeveloperGalleryScreen'

describe('useSettingsDeveloperGalleryScreen', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns a non-empty categories array containing all 5 expected ids', () => {
        const { result } = renderHook(() => useSettingsDeveloperGalleryScreen())

        const ids = result.current.categories.map(c => c.id)
        expect(ids).toContain('screens')
        expect(ids).toContain('sheets')
        expect(ids).toContain('dialogs')
        expect(ids).toContain('components')
        expect(ids).toContain('tools')
        expect(result.current.categories.length).toBeGreaterThan(0)
    })

    it('openCategory navigates to GalleryCategory with the given id', () => {
        const { result } = renderHook(() => useSettingsDeveloperGalleryScreen())

        act(() => {
            result.current.openCategory('dialogs')
        })

        expect(navigate).toHaveBeenCalledWith('GalleryCategory', {
            categoryId: 'dialogs',
        })
    })
})
