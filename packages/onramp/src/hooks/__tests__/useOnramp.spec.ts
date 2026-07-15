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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useOnrampStore } from '../../store'
import { useOnramp } from '../useOnramp'

describe('onramp/useOnramp', () => {
    beforeEach(() => {
        useOnrampStore.getState().resetState()
    })

    test('exposes initial state', () => {
        const { result } = renderHook(() => useOnramp())

        expect(result.current.selectedSourceTokenId).toBeNull()
        expect(result.current.selectedDestinationTokenId).toBeNull()
        expect(result.current.senderAddress).toBe('')
    })

    test('setSelectedSourceTokenId updates selectedSourceTokenId', () => {
        const { result } = renderHook(() => useOnramp())

        act(() => {
            result.current.setSelectedSourceTokenId('USD')
        })

        expect(result.current.selectedSourceTokenId).toBe('USD')
    })

    test('setSelectedDestinationTokenId updates selectedDestinationTokenId', () => {
        const { result } = renderHook(() => useOnramp())

        act(() => {
            result.current.setSelectedDestinationTokenId('ALGO')
        })

        expect(result.current.selectedDestinationTokenId).toBe('ALGO')
    })

    test('setSenderAddress updates senderAddress', () => {
        const { result } = renderHook(() => useOnramp())

        act(() => {
            result.current.setSenderAddress('ALGO123')
        })

        expect(result.current.senderAddress).toBe('ALGO123')
    })
})
