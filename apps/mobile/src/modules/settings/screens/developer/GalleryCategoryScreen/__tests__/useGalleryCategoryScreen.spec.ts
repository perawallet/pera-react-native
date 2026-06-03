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
import { renderHook } from '@testing-library/react'

// Mutable variable so each test can control the category id
let currentCategoryId = 'screens'

const setOptions = vi.fn()
const launch = vi.fn()
const onSeedContacts = vi.fn()
const onReplayApi = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useRoute: () => ({ params: { categoryId: currentCategoryId } }),
        useNavigation: () => ({ setOptions }),
    }
})

vi.mock('../../gallery-catalog/useGalleryLauncher', () => ({
    useGalleryLauncher: () => ({ launch }),
}))

vi.mock('../../gallery-catalog/useGalleryToolHandlers', () => ({
    useGalleryToolHandlers: () => ({ onSeedContacts, onReplayApi }),
}))

import { useGalleryCategoryScreen } from '../useGalleryCategoryScreen'

describe('useGalleryCategoryScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        currentCategoryId = 'screens'
    })

    it("returns title 'Screens' and non-empty sections for categoryId 'screens'", () => {
        currentCategoryId = 'screens'

        const { result } = renderHook(() => useGalleryCategoryScreen())

        expect(result.current.title).toBe('Screens')
        expect(result.current.sections.length).toBeGreaterThan(0)
        result.current.sections.forEach(section => {
            expect(section.items.length).toBeGreaterThan(0)
        })
    })

    it("returns title 'Gallery' and empty sections for an unknown categoryId", () => {
        currentCategoryId = 'bogus'

        const { result } = renderHook(() => useGalleryCategoryScreen())

        expect(result.current.title).toBe('Gallery')
        expect(result.current.sections).toEqual([])
    })

    it('onItemPress delegates to the launcher launch function', () => {
        currentCategoryId = 'screens'
        const { result } = renderHook(() => useGalleryCategoryScreen())
        const fakeEntry = {
            id: 'test-entry',
            label: 'Test',
            launch: { kind: 'action' as const, run: vi.fn() },
        }

        result.current.onItemPress(fakeEntry)

        expect(launch).toHaveBeenCalledWith(fakeEntry)
    })
})
