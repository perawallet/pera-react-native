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
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import { useMinFeeForSender } from '../useMinFeeForSender'

describe('useMinFeeForSender', () => {
    const chainHook = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        chainHook.mockReturnValue({ minFee: 3000n, isPending: false })
        registerFakePlannerAdapter({ useMinFeeForSender: chainHook })
    })

    it('returns what the planner hook returns, with the sender passed through', () => {
        const { result } = renderHook(() =>
            useMinFeeForSender('QADDR', 'algorand'),
        )

        expect(chainHook).toHaveBeenCalledWith('QADDR')
        expect(result.current).toEqual({ minFee: 3000n, isPending: false })
    })

    it('passes an undefined sender through', () => {
        chainHook.mockReturnValue({ minFee: undefined, isPending: false })
        const { result } = renderHook(() =>
            useMinFeeForSender(undefined, 'algorand'),
        )

        expect(chainHook).toHaveBeenCalledWith(undefined)
        expect(result.current.minFee).toBeUndefined()
    })
})
