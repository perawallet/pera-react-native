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
import { BackHandler } from 'react-native'
import { useBlockHardwareBack } from '../useBlockHardwareBack'

const remove = vi.fn()
const addEventListener = vi.fn(() => ({ remove }))

vi.mock('react-native', () => ({
    BackHandler: {
        get addEventListener() {
            return addEventListener
        },
    },
}))

describe('useBlockHardwareBack', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not register a handler while not blocking', () => {
        renderHook(() => useBlockHardwareBack(false))

        expect(BackHandler.addEventListener).not.toHaveBeenCalled()
    })

    it('swallows the back press while blocking', () => {
        renderHook(() => useBlockHardwareBack(true))

        expect(addEventListener).toHaveBeenCalledWith(
            'hardwareBackPress',
            expect.any(Function),
        )
        const handler = addEventListener.mock.calls[0][1] as () => boolean
        expect(handler()).toBe(true)
    })

    it('removes the handler when blocking stops', () => {
        const { rerender } = renderHook(
            ({ isBlocking }) => useBlockHardwareBack(isBlocking),
            { initialProps: { isBlocking: true } },
        )

        expect(remove).not.toHaveBeenCalled()

        rerender({ isBlocking: false })

        expect(remove).toHaveBeenCalledTimes(1)
    })
})
