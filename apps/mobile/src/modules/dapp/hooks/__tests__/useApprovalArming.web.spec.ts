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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    APPROVAL_ARMING_DELAY_MS,
    useApprovalArming,
} from '../useApprovalArming.web'

describe('useApprovalArming', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stays disarmed on first paint', () => {
        const { result } = renderHook(() => useApprovalArming())

        expect(result.current).toBe(false)
    })

    // The clickjacking shape: the opener's click delivers only its mouseup here.
    it('stays disarmed after the delay when nothing happened in this window', () => {
        const { result } = renderHook(() => useApprovalArming())

        act(() => {
            vi.advanceTimersByTime(APPROVAL_ARMING_DELAY_MS)
            window.dispatchEvent(new Event('mouseup'))
        })

        expect(result.current).toBe(false)
    })

    it('stays disarmed when input arrives before the delay has passed', () => {
        const { result } = renderHook(() => useApprovalArming())

        act(() => {
            window.dispatchEvent(new Event('pointermove'))
            vi.advanceTimersByTime(APPROVAL_ARMING_DELAY_MS - 1)
        })

        expect(result.current).toBe(false)
    })

    it.each(['pointermove', 'pointerdown', 'keydown'])(
        'arms once the delay has passed and %s happened in this window',
        type => {
            const { result } = renderHook(() => useApprovalArming())

            act(() => {
                window.dispatchEvent(new Event(type))
                vi.advanceTimersByTime(APPROVAL_ARMING_DELAY_MS)
            })

            expect(result.current).toBe(true)
        },
    )
})
