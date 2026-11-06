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
import { useFailedHoldingChainIds } from '../useFailedHoldingChainIds'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const SOURCES = [
    { scope: ETHEREUM, address: '0xA' },
    { scope: BASE, address: '0xA' },
]

describe('useFailedHoldingChainIds', () => {
    beforeEach(() => {
        useHoldingsRefreshStore.getState().resetState()
    })

    it('lists only the chains whose last read failed, not ones never read', () => {
        const { result } = renderHook(() => useFailedHoldingChainIds(SOURCES))
        expect(result.current.size).toBe(0)

        act(() =>
            useHoldingsRefreshStore
                .getState()
                .setHoldingsRefreshFailed(BASE, '0xA', true),
        )
        expect([...result.current]).toEqual(['base'])

        act(() =>
            useHoldingsRefreshStore
                .getState()
                .setHoldingsRefreshFailed(BASE, '0xA', false),
        )
        expect(result.current.size).toBe(0)
    })

    it('keeps the same set while no read changes', () => {
        const { result, rerender } = renderHook(() =>
            useFailedHoldingChainIds(SOURCES),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })
})
