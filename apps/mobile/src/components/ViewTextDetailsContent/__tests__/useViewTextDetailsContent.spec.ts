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
import { act, renderHook } from '@testing-library/react'
import { useViewTextDetailsContent } from '../useViewTextDetailsContent'

const mocks = vi.hoisted(() => ({ copyToClipboard: vi.fn() }))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mocks.copyToClipboard }),
}))

describe('useViewTextDetailsContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the text as it is, and copies what it shows', () => {
        const { result } = renderHook(() =>
            useViewTextDetailsContent({ text: 'pera' }),
        )

        expect(result.current.textToDisplay).toBe('pera')

        act(() => result.current.copyText())

        expect(mocks.copyToClipboard).toHaveBeenCalledWith('pera')
    })

    it('shows the hex and the base64 forms of the text', () => {
        const { result } = renderHook(() =>
            useViewTextDetailsContent({ text: 'pera' }),
        )

        act(() => result.current.handleSelectHex())
        expect(result.current.textToDisplay).toBe(
            Buffer.from('pera').toString('hex'),
        )

        act(() => result.current.handleSelectBase64())
        expect(result.current.textToDisplay).toBe(
            Buffer.from('pera').toString('base64'),
        )
    })
})
