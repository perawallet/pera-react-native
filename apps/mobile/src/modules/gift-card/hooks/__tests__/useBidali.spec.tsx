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

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useBidali } from '../useBidali'

const mockAccount: WalletAccount = {
    address: 'TESTADDRESS123',
    name: 'Test Account',
    type: 'algo25',
    keyPairId: 'test-key-pair-id',
}

describe('useBidali', () => {
    beforeEach(() => {
        const { result } = renderHook(() => useBidali())
        act(() => result.current.reset())
    })

    it('returns initial state', () => {
        const { result } = renderHook(() => useBidali())
        expect(result.current.selectedAccount).toBeUndefined()
        expect(result.current.onClose).toBeUndefined()
    })

    it('sets selected account', () => {
        const { result } = renderHook(() => useBidali())
        act(() => result.current.setSelectedAccount(mockAccount))
        expect(result.current.selectedAccount).toEqual(mockAccount)
    })

    it('sets onClose callback', () => {
        const { result } = renderHook(() => useBidali())
        const callback = () => {}
        act(() => result.current.setOnClose(callback))
        expect(result.current.onClose).toBe(callback)
    })

    it('resets all state', () => {
        const { result } = renderHook(() => useBidali())
        const callback = () => {}

        act(() => {
            result.current.setSelectedAccount(mockAccount)
            result.current.setOnClose(callback)
        })

        expect(result.current.selectedAccount).toEqual(mockAccount)
        expect(result.current.onClose).toBe(callback)

        act(() => result.current.reset())

        expect(result.current.selectedAccount).toBeUndefined()
        expect(result.current.onClose).toBeUndefined()
    })

    it('shares state across hook instances', () => {
        const { result: a } = renderHook(() => useBidali())
        const { result: b } = renderHook(() => useBidali())

        act(() => a.current.setSelectedAccount(mockAccount))
        expect(b.current.selectedAccount).toEqual(mockAccount)
    })
})
