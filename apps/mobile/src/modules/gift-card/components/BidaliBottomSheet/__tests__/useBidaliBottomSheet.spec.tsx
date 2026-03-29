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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBidaliBottomSheet } from '../useBidaliBottomSheet'
import { useBidali } from '../../../hooks/useBidali'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockAccount: WalletAccount = {
    address: 'TESTADDRESS123',
    name: 'Test',
    type: 'algo25',
}

describe('useBidaliBottomSheet', () => {
    beforeEach(() => {
        const { result } = renderHook(() => useBidali())
        act(() => result.current.reset())
    })

    it('sets onClose in store when visible', () => {
        const onClose = vi.fn()
        renderHook(() => useBidaliBottomSheet(true, onClose))

        const { result: store } = renderHook(() => useBidali())
        expect(store.current.onClose).toBeDefined()
    })

    it('calling onClose resets store and calls parent onClose', () => {
        const onClose = vi.fn()
        renderHook(() => useBidaliBottomSheet(true, onClose))

        const { result: store } = renderHook(() => useBidali())

        // Simulate state that should be cleared
        act(() => store.current.setSelectedAccount(mockAccount))
        expect(store.current.selectedAccount).toEqual(mockAccount)

        // Trigger close
        act(() => store.current.onClose?.())

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(store.current.selectedAccount).toBeUndefined()
    })
})
