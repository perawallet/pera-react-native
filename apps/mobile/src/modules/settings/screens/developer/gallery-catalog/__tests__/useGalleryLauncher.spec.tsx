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

const navigate = vi.fn()
const request = vi.fn()
const requestByType = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate }),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request, requestByType }),
}))

import { useGalleryLauncher } from '../useGalleryLauncher'

import type { GalleryEntry } from '../types'

describe('useGalleryLauncher', () => {
    beforeEach(() => vi.clearAllMocks())

    it('navigates for a navigate entry', () => {
        const { result } = renderHook(() => useGalleryLauncher())
        const entry: GalleryEntry = {
            id: 'scr-x',
            label: 'X',
            launch: { kind: 'navigate', target: { name: 'Search' } },
        }
        result.current.launch(entry)
        expect(navigate).toHaveBeenCalledWith('Search', undefined)
    })

    it('routes a preview entry to GalleryPreview with the entry id', () => {
        const { result } = renderHook(() => useGalleryLauncher())
        result.current.launch({ id: 'comp-y', label: 'Y', launch: { kind: 'preview' } })
        expect(navigate).toHaveBeenCalledWith('GalleryPreview', { entryId: 'comp-y' })
    })

    it('runs an action entry', () => {
        const run = vi.fn()
        const { result } = renderHook(() => useGalleryLauncher())
        result.current.launch({ id: 'tool-z', label: 'Z', launch: { kind: 'action', run } })
        expect(run).toHaveBeenCalledOnce()
    })
})
