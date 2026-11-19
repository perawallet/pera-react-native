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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiscoverEvent, HomeEvent, trackEvent } from '@analytics'
import { useAccountHeaderToolbar } from '../useAccountHeaderToolbar'

const request = vi.fn()
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual('@modules/bottom-sheet')),
    useBottomSheet: () => ({ request }),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual('@analytics')),
    trackEvent: vi.fn(),
}))

const HOME_EVENTS = {
    qrScan: HomeEvent.QrScan,
    pasteLink: HomeEvent.PasteLink,
} as const

describe('useAccountHeaderToolbar', () => {
    beforeEach(() => vi.clearAllMocks())

    it('opens and closes the QR scanner, tracking the open', () => {
        const { result } = renderHook(() =>
            useAccountHeaderToolbar({ events: HOME_EVENTS }),
        )
        expect(result.current.isScannerOpen).toBe(false)

        act(() => result.current.openScanner())
        expect(result.current.isScannerOpen).toBe(true)
        expect(trackEvent).toHaveBeenCalledWith(HomeEvent.QrScan)

        act(() => result.current.closeScanner())
        expect(result.current.isScannerOpen).toBe(false)
    })

    it('opens the paste-link sheet and tracks it', () => {
        const { result } = renderHook(() =>
            useAccountHeaderToolbar({ events: HOME_EVENTS }),
        )

        act(() => result.current.openPasteLink())

        expect(trackEvent).toHaveBeenCalledWith(HomeEvent.PasteLink)
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            }),
        )
    })

    it("tracks the host screen's own events", () => {
        const { result } = renderHook(() =>
            useAccountHeaderToolbar({
                events: {
                    qrScan: DiscoverEvent.QrScan,
                    pasteLink: DiscoverEvent.PasteLink,
                },
            }),
        )

        act(() => result.current.openScanner())
        act(() => result.current.openPasteLink())

        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.QrScan)
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.PasteLink)
        expect(trackEvent).not.toHaveBeenCalledWith(HomeEvent.QrScan)
    })
})
