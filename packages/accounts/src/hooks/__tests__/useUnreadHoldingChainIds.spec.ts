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
import { useAccountChainStateStore } from '../../store/accountChainState'
import { useHoldingsRefreshStore } from '../../store/holdingsRefresh'
import { useUnreadHoldingChainIds } from '../useUnreadHoldingChainIds'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const SOURCES = [
    { scope: ETHEREUM, address: '0xA' },
    { scope: BASE, address: '0xA' },
]

const markRead = (scope: ChainScope) =>
    useAccountChainStateStore.getState().setAccountChainState(scope, '0xA', {
        family: 'evm',
        nonce: { latest: 0, pending: 0 },
    })

describe('useUnreadHoldingChainIds', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        useHoldingsRefreshStore.getState().resetState()
    })

    it('lists a chain until a read lands, and again once its last read fails', () => {
        const { result } = renderHook(() => useUnreadHoldingChainIds(SOURCES))
        expect([...result.current]).toEqual(['ethereum', 'base'])

        act(() => {
            markRead(ETHEREUM)
            markRead(BASE)
        })
        expect(result.current.size).toBe(0)

        act(() =>
            useHoldingsRefreshStore
                .getState()
                .setHoldingsRefreshFailed(BASE, '0xA', true),
        )
        expect([...result.current]).toEqual(['base'])
    })

    it('keeps the same set while no read changes', () => {
        const { result, rerender } = renderHook(() =>
            useUnreadHoldingChainIds(SOURCES),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })
})
