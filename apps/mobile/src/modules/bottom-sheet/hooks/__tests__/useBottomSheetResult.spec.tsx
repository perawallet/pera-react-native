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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, beforeEach } from 'vitest'

import { useBottomSheetStore } from '../../store/bottomSheetStore'
import { BottomSheetIdContext } from '../../components/BottomSheetHost/BottomSheetIdContext'
import { useBottomSheetResult } from '../useBottomSheetResult'

describe('useBottomSheetResult', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('throws when used outside a host', () => {
        expect(() => renderHook(() => useBottomSheetResult())).toThrow(
            /inside a bottom sheet/i,
        )
    })

    it('resolve(value) marks the request invisible and stashes the value', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: 'A' })
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BottomSheetIdContext.Provider value='x'>
                {children}
            </BottomSheetIdContext.Provider>
        )
        const { result } = renderHook(() => useBottomSheetResult<string>(), {
            wrapper,
        })
        act(() => {
            result.current.resolve('confirm')
        })
        // promise is still pending until host calls remove
        const req = useBottomSheetStore
            .getState()
            .requests.find(r => r.id === 'x')
        expect(req?.isVisible).toBe(false)
        // simulate host's post-animation remove
        act(() => {
            useBottomSheetStore.getState().remove('x')
        })
        await expect(promise).resolves.toBe('confirm')
    })

    it('dismiss() yields undefined on remove', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: 'A' })
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BottomSheetIdContext.Provider value='x'>
                {children}
            </BottomSheetIdContext.Provider>
        )
        const { result } = renderHook(() => useBottomSheetResult<string>(), {
            wrapper,
        })
        act(() => {
            result.current.dismiss()
        })
        act(() => {
            useBottomSheetStore.getState().remove('x')
        })
        await expect(promise).resolves.toBeUndefined()
    })
})
