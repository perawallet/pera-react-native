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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    useScannerRequest,
    useScannerRequestStore,
    useTrackOpenScanner,
} from '../useScannerRequest'

describe('useScannerRequest', () => {
    beforeEach(() => {
        useScannerRequestStore.setState({
            isRequested: false,
            openScannerCount: 0,
        })
    })

    // Cold start: the link is handled before the home screen mounts.
    it('opens the scanner on mount when a request is already pending', () => {
        useScannerRequestStore.getState().requestScanner()
        const open = vi.fn()

        renderHook(() => useScannerRequest(open))

        expect(open).toHaveBeenCalledOnce()
        expect(useScannerRequestStore.getState().isRequested).toBe(false)
    })

    it('opens the scanner when a request arrives while mounted', () => {
        const open = vi.fn()
        renderHook(() => useScannerRequest(open))

        act(() => useScannerRequestStore.getState().requestScanner())

        expect(open).toHaveBeenCalledOnce()
    })

    it('opens once per request', () => {
        const open = vi.fn()
        const { rerender } = renderHook(() => useScannerRequest(open))

        act(() => useScannerRequestStore.getState().requestScanner())
        rerender()
        act(() => useScannerRequestStore.getState().requestScanner())

        expect(open).toHaveBeenCalledTimes(2)
    })

    it('does nothing without a request', () => {
        const open = vi.fn()

        renderHook(() => useScannerRequest(open))

        expect(open).not.toHaveBeenCalled()
    })
})

describe('useTrackOpenScanner', () => {
    beforeEach(() => {
        useScannerRequestStore.setState({
            isRequested: false,
            openScannerCount: 0,
        })
    })

    it('counts a scanner while it is open', () => {
        const { rerender } = renderHook(
            ({ isOpen }) => useTrackOpenScanner(isOpen),
            {
                initialProps: { isOpen: false },
            },
        )
        expect(useScannerRequestStore.getState().openScannerCount).toBe(0)

        rerender({ isOpen: true })
        expect(useScannerRequestStore.getState().openScannerCount).toBe(1)

        rerender({ isOpen: false })
        expect(useScannerRequestStore.getState().openScannerCount).toBe(0)
    })

    it('stops counting a scanner that unmounts while open', () => {
        const { unmount } = renderHook(() => useTrackOpenScanner(true))

        unmount()

        expect(useScannerRequestStore.getState().openScannerCount).toBe(0)
    })

    it('counts every open scanner on screen', () => {
        renderHook(() => useTrackOpenScanner(true))
        renderHook(() => useTrackOpenScanner(true))

        expect(useScannerRequestStore.getState().openScannerCount).toBe(2)
    })
})
