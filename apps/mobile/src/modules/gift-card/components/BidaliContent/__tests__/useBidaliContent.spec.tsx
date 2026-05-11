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

import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { useBidaliContent } from '../useBidaliContent'
import { useBidali } from '../../../hooks/useBidali'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockAccount: WalletAccount = {
    address: 'TESTADDRESS123',
    name: 'Test',
    type: 'algo25',
    keyPairId: 'test-key-pair-id',
}

const wrapWithId =
    (id: string) =>
    ({ children }: { children: React.ReactNode }) => (
        <BottomSheetIdContext.Provider value={id}>
            {children}
        </BottomSheetIdContext.Provider>
    )

describe('useBidaliContent', () => {
    beforeEach(() => {
        const { result } = renderHook(() => useBidali())
        act(() => result.current.reset())
        useBottomSheetStore.getState().resetState()
    })

    it('sets onClose in the Bidali store', () => {
        renderHook(() => useBidaliContent(), {
            wrapper: wrapWithId('sheet-1'),
        })

        const { result: store } = renderHook(() => useBidali())
        expect(store.current.onClose).toBeDefined()
    })

    it('calling onClose resets the Bidali store and dismisses the sheet', () => {
        const promise = useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })

        renderHook(() => useBidaliContent(), {
            wrapper: wrapWithId('sheet-1'),
        })

        const { result: store } = renderHook(() => useBidali())

        // Simulate state that should be cleared on close.
        act(() => store.current.setSelectedAccount(mockAccount))
        expect(store.current.selectedAccount).toEqual(mockAccount)

        // Trigger close via the store's onClose entry point.
        act(() => store.current.onClose?.())

        // Bidali store reset.
        expect(store.current.selectedAccount).toBeUndefined()

        // Bottom sheet marked invisible (two-phase). Simulate host remove.
        useBottomSheetStore.getState().remove('sheet-1')
        return expect(promise).resolves.toBeUndefined()
    })
})
