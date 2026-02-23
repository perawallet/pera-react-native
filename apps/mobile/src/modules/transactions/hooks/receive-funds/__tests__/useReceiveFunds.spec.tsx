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
import { useReceiveFunds, useReceiveFundsStore } from '../useReceiveFunds'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockAccount: WalletAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch',
}

describe('useReceiveFunds', () => {
    beforeEach(() => {
        // Reset the store before each test
        act(() => {
            useReceiveFundsStore.getState().reset()
        })
    })

    it('returns initial state', () => {
        const { result } = renderHook(() => useReceiveFunds())

        expect(result.current.selectedAccount).toBeUndefined()
        expect(result.current.canSelectAccount).toBe(true)
        expect(result.current.onFinished).toBeUndefined()
    })

    it('sets selected account', () => {
        const { result } = renderHook(() => useReceiveFunds())

        act(() => {
            result.current.setSelectedAccount(mockAccount)
        })

        expect(result.current.selectedAccount).toEqual(mockAccount)
    })

    it('sets canSelectAccount', () => {
        const { result } = renderHook(() => useReceiveFunds())

        act(() => {
            result.current.setCanSelectAccount(false)
        })

        expect(result.current.canSelectAccount).toBe(false)
    })

    it('sets onFinished callback', () => {
        const { result } = renderHook(() => useReceiveFunds())
        const mockCallback = () => {}

        act(() => {
            result.current.setOnFinished(mockCallback)
        })

        expect(result.current.onFinished).toBe(mockCallback)
    })

    it('resets state', () => {
        const { result } = renderHook(() => useReceiveFunds())
        const mockCallback = () => {}

        act(() => {
            result.current.setSelectedAccount(mockAccount)
            result.current.setCanSelectAccount(false)
            result.current.setOnFinished(mockCallback)
        })

        expect(result.current.selectedAccount).toEqual(mockAccount)
        expect(result.current.canSelectAccount).toBe(false)
        expect(result.current.onFinished).toBe(mockCallback)

        act(() => {
            result.current.reset()
        })

        expect(result.current.selectedAccount).toBeUndefined()
        expect(result.current.canSelectAccount).toBe(true)
        expect(result.current.onFinished).toBeUndefined()
    })

    it('clears selected account', () => {
        const { result } = renderHook(() => useReceiveFunds())

        act(() => {
            result.current.setSelectedAccount(mockAccount)
        })

        expect(result.current.selectedAccount).toEqual(mockAccount)

        act(() => {
            result.current.setSelectedAccount(undefined)
        })

        expect(result.current.selectedAccount).toBeUndefined()
    })
})
