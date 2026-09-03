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

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBottomSheetStore } from '../../../store/bottomSheetStore'
import type { InternalRequest } from '../../../types'
import { usePresentableRequests } from '../usePresentableRequests'

const makeRequest = (id: string): InternalRequest => ({
    id,
    contents: null,
    isVisible: true,
    resolver: () => {},
})

const setStack = (requests: InternalRequest[]) =>
    act(() => {
        useBottomSheetStore.setState({ requests })
    })

const setHeld = (isHeld: boolean) =>
    act(() => {
        useBottomSheetStore.getState().setPresentationHeld(isHeld, 'app-lock')
    })

describe('usePresentableRequests', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('passes stacked requests through while presentation is not held', () => {
        const request = makeRequest('sheet-1')

        const { result } = renderHook(() => usePresentableRequests())
        setStack([request])

        expect(result.current).toEqual([request])
    })

    // Centralized here: a sheet presented while AutoLockGuard's overlay
    // covers the app surfaces the instant the PIN is accepted. Holding here
    // covers every sheet at once instead of per-driver gates.
    it('holds a request that arrives while presentation is held', () => {
        setHeld(true)

        const { result } = renderHook(() => usePresentableRequests())
        setStack([makeRequest('sheet-1')])

        expect(result.current).toEqual([])
    })

    it('presents the held request once the hold lifts', () => {
        setHeld(true)
        const request = makeRequest('sheet-1')

        const { result } = renderHook(() => usePresentableRequests())
        setStack([request])
        expect(result.current).toEqual([])

        setHeld(false)

        expect(result.current).toEqual([request])
    })

    it('keeps an already-presented sheet when the hold re-engages', () => {
        // Dismissing a live sheet on relock would churn gorhom's modal stack
        // for nothing — the lock overlay already covers it.
        const request = makeRequest('sheet-1')

        const { result } = renderHook(() => usePresentableRequests())
        setStack([request])
        expect(result.current).toEqual([request])

        setHeld(true)

        expect(result.current).toEqual([request])
    })

    it('never presents a request dismissed while it was held', () => {
        setHeld(true)

        const { result } = renderHook(() => usePresentableRequests())
        setStack([makeRequest('sheet-1')])
        expect(result.current).toEqual([])

        // The requesting driver dismissed it while the hold was up (e.g. the
        // sign request expired) — dismissal is not gated by the hold.
        setStack([])
        setHeld(false)

        expect(result.current).toEqual([])
    })
})
