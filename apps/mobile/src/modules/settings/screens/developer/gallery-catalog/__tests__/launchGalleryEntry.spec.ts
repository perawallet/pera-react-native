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

const {
    mockNavigate,
    mockIsReady,
    mockRequest,
    mockRequestByType,
    mockDismissAll,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockIsReady: vi.fn(() => true),
    mockRequest: vi.fn(),
    mockRequestByType: vi.fn(),
    mockDismissAll: vi.fn(),
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: { isReady: mockIsReady, navigate: mockNavigate },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: {
        getState: () => ({
            request: mockRequest,
            requestByType: mockRequestByType,
            dismissAll: mockDismissAll,
        }),
    },
}))

import { launchGalleryEntry } from '../launchGalleryEntry'

describe('launchGalleryEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsReady.mockReturnValue(true)
    })

    it('navigates for a navigate entry and reports launched', () => {
        const outcome = launchGalleryEntry({
            id: 'scr-x',
            label: 'X',
            launch: {
                kind: 'navigate',
                target: { name: 'Home', params: { a: 1 } },
            },
        })

        expect(mockNavigate).toHaveBeenCalledWith('Home', { a: 1 })
        expect(outcome).toBe('launched')
    })

    it('routes a preview entry to the nested GalleryPreview screen carrying the entry id, and reports launched', () => {
        const outcome = launchGalleryEntry({
            id: 'comp-y',
            label: 'Y',
            launch: { kind: 'preview' },
        })

        expect(mockNavigate).toHaveBeenCalledWith('Settings', {
            screen: 'DeveloperSettings',
            params: {
                screen: 'GalleryPreview',
                params: { entryId: 'comp-y' },
            },
        })
        expect(outcome).toBe('launched')
    })

    it('runs the callback for an action entry and reports launched', () => {
        const run = vi.fn()

        const outcome = launchGalleryEntry({
            id: 'tool-z',
            label: 'Z',
            launch: { kind: 'action', run },
        })

        expect(run).toHaveBeenCalledOnce()
        expect(outcome).toBe('launched')
    })

    it('requests a sheet for a sheet entry and reports launched', () => {
        const sheetRequest = { contents: null }
        const request = vi.fn(() => sheetRequest)

        const outcome = launchGalleryEntry({
            id: 'sheet-a',
            label: 'A',
            launch: { kind: 'sheet', request },
        })

        expect(request).toHaveBeenCalledOnce()
        expect(mockRequest).toHaveBeenCalledWith(sheetRequest)
        expect(outcome).toBe('launched')
    })

    it('requests a sheet by type for a sheetByType entry and reports launched', () => {
        const outcome = launchGalleryEntry({
            id: 'sheet-b',
            label: 'B',
            launch: {
                kind: 'sheetByType',
                type: 'account-actions',
                props: { address: 'ADDR' },
                options: { enablePanDownToClose: true },
            },
        })

        expect(mockRequestByType).toHaveBeenCalledWith(
            'account-actions',
            { address: 'ADDR' },
            { enablePanDownToClose: true },
        )
        expect(outcome).toBe('launched')
    })

    it('does nothing and reports navigation-not-ready when navigation is not ready', () => {
        mockIsReady.mockReturnValue(false)

        const outcome = launchGalleryEntry({
            id: 'scr-x',
            label: 'X',
            launch: { kind: 'navigate', target: { name: 'Home' } },
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        expect(outcome).toBe('navigation-not-ready')
    })

    it('still does not navigate for a preview entry when navigation is not ready, and reports navigation-not-ready', () => {
        mockIsReady.mockReturnValue(false)

        const outcome = launchGalleryEntry({
            id: 'comp-y',
            label: 'Y',
            launch: { kind: 'preview' },
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        expect(outcome).toBe('navigation-not-ready')
    })

    it('runs an action entry even when navigation is not ready, and reports launched', () => {
        mockIsReady.mockReturnValue(false)
        const run = vi.fn()

        const outcome = launchGalleryEntry({
            id: 'tool-z',
            label: 'Z',
            launch: { kind: 'action', run },
        })

        expect(run).toHaveBeenCalledOnce()
        expect(outcome).toBe('launched')
    })

    it('requests a sheet entry even when navigation is not ready, and reports launched', () => {
        mockIsReady.mockReturnValue(false)
        const sheetRequest = { contents: null }
        const request = vi.fn(() => sheetRequest)

        const outcome = launchGalleryEntry({
            id: 'sheet-a',
            label: 'A',
            launch: { kind: 'sheet', request },
        })

        expect(mockRequest).toHaveBeenCalledWith(sheetRequest)
        expect(outcome).toBe('launched')
    })

    it('requests a sheet by type entry even when navigation is not ready, and reports launched', () => {
        mockIsReady.mockReturnValue(false)

        const outcome = launchGalleryEntry({
            id: 'sheet-b',
            label: 'B',
            launch: {
                kind: 'sheetByType',
                type: 'account-actions',
                props: { address: 'ADDR' },
                options: { enablePanDownToClose: true },
            },
        })

        expect(mockRequestByType).toHaveBeenCalled()
        expect(outcome).toBe('launched')
    })
})
