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
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useHoldingsRefreshStore } from '../../store/holdingsRefresh'
import { useIsHoldingsRefreshFailed } from '../useIsHoldingsRefreshFailed'

const SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }

describe('useIsHoldingsRefreshFailed', () => {
    beforeEach(() => {
        useHoldingsRefreshStore.getState().resetState()
    })

    it('follows the flag for that address on that scope only', () => {
        const { result } = renderHook(() =>
            useIsHoldingsRefreshFailed(SCOPE, 'ADDR1'),
        )
        expect(result.current).toBe(false)

        act(() =>
            useHoldingsRefreshStore
                .getState()
                .setHoldingsRefreshFailed(SCOPE, 'ADDR1', true),
        )
        expect(result.current).toBe(true)

        const other = renderHook(() =>
            useIsHoldingsRefreshFailed(SCOPE, 'ADDR2'),
        )
        expect(other.result.current).toBe(false)

        act(() =>
            useHoldingsRefreshStore
                .getState()
                .setHoldingsRefreshFailed(SCOPE, 'ADDR1', false),
        )
        expect(result.current).toBe(false)
    })
})
