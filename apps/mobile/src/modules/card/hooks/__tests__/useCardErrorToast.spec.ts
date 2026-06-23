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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ errorToast: vi.fn() }))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: vi.fn(),
        errorToast: mocks.errorToast,
        showToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

import { useCardErrorToast } from '../useCardErrorToast'

describe('useCardErrorToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('surfaces the backend message when present', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        await act(async () => {
            // ky HTTPError shape: status in `response`, parsed body in `data`.
            await result.current({
                response: { status: 400 },
                data: { message: "user doesn't have a card" },
            })
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            expect.any(String),
            "user doesn't have a card",
        )
    })

    it('falls back to a generic body when the error has no message', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        await act(async () => {
            await result.current(new Error('boom'))
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'peraCard.account.error_title',
            'peraCard.account.error_body',
        )
    })
})
