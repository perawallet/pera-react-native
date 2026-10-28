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

// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    FAKE_NATIVE_ASSET_ID,
    FAKE_RECEIVE_ASSET_ID,
} from '../../__tests__/fakeSwapAdapter'
import { useSwapsStore } from '../../store'
import { useSwaps } from '../useSwaps'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

describe('swaps/useSwaps', () => {
    beforeEach(() => {
        useSwapsStore.getState().resetState()
    })

    test("defaults the pair to the chain adapter's native and receive assets", () => {
        const { result } = renderHook(() => useSwaps(SCOPE))

        expect(result.current.fromAsset).toBe(FAKE_NATIVE_ASSET_ID)
        expect(result.current.toAsset).toBe(FAKE_RECEIVE_ASSET_ID)
    })

    test('setFromAsset updates fromAsset', () => {
        const { result } = renderHook(() => useSwaps(SCOPE))

        act(() => {
            result.current.setFromAsset('999')
        })

        expect(result.current.fromAsset).toBe('999')
    })

    test('setToAsset updates toAsset', () => {
        const { result } = renderHook(() => useSwaps(SCOPE))

        act(() => {
            result.current.setToAsset('777')
        })

        expect(result.current.toAsset).toBe('777')
    })
})
