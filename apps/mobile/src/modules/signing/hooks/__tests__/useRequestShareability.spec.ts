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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRequestAddressSafety } from '../useRequestAddressSafety'
import { useRequestShareability } from '../useRequestShareability'

vi.mock('../useRequestAddressSafety', () => ({
    useRequestAddressSafety: vi.fn(),
}))

const safety = (isChecking: boolean, hasListedAddress: boolean) =>
    vi.mocked(useRequestAddressSafety).mockReturnValue({
        isChecking,
        hasListedAddress,
    } as ReturnType<typeof useRequestAddressSafety>)

describe('useRequestShareability', () => {
    it('holds the request while its addresses are being checked', () => {
        safety(true, false)

        expect(
            renderHook(() => useRequestShareability()).result.current,
        ).toEqual({
            isChecking: true,
            isShareable: false,
        })
    })

    it('never shares a request naming a scam-listed address, and shares a clear one', () => {
        safety(false, true)
        expect(
            renderHook(() => useRequestShareability()).result.current
                .isShareable,
        ).toBe(false)

        safety(false, false)
        expect(
            renderHook(() => useRequestShareability()).result.current
                .isShareable,
        ).toBe(true)
    })
})
