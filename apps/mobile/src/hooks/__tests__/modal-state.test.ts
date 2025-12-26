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

import { renderHook, act } from '@testing-library/react-native'
import { useModalState } from '../modal-state'

describe('useModalState', () => {
    it('should initialize with default value', () => {
        const { result } = renderHook(() => useModalState())
        expect(result.current.isOpen).toBe(false)
    })

    it('should initialize with provided value', () => {
        const { result } = renderHook(() => useModalState(true))
        expect(result.current.isOpen).toBe(true)
    })

    it('should open modal', () => {
        const { result } = renderHook(() => useModalState())
        act(() => {
            result.current.open()
        })
        expect(result.current.isOpen).toBe(true)
    })

    it('should close modal', () => {
        const { result } = renderHook(() => useModalState(true))
        act(() => {
            result.current.close()
        })
        expect(result.current.isOpen).toBe(false)
    })

    it('should toggle modal', () => {
        const { result } = renderHook(() => useModalState())
        act(() => {
            result.current.toggle()
        })
        expect(result.current.isOpen).toBe(true)
        act(() => {
            result.current.toggle()
        })
        expect(result.current.isOpen).toBe(false)
    })
})
