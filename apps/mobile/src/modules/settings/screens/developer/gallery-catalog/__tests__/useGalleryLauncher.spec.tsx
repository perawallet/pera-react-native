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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockLaunchGalleryEntry } = vi.hoisted(() => ({
    mockLaunchGalleryEntry: vi.fn(),
}))

vi.mock('../launchGalleryEntry', () => ({
    launchGalleryEntry: mockLaunchGalleryEntry,
}))

import { useGalleryLauncher } from '../useGalleryLauncher'

import type { GalleryEntry } from '../types'

describe('useGalleryLauncher', () => {
    beforeEach(() => vi.clearAllMocks())

    it('delegates the entry to launchGalleryEntry', () => {
        const { result } = renderHook(() => useGalleryLauncher())
        const entry: GalleryEntry = {
            id: 'scr-x',
            label: 'X',
            launch: { kind: 'navigate', target: { name: 'Search' } },
        }

        result.current.launch(entry)

        expect(mockLaunchGalleryEntry).toHaveBeenCalledWith(entry)
    })
})
