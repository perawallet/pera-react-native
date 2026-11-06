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
import { useFailedFirstReadChainIds } from '../useFailedFirstReadChainIds'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const SOURCES = [
    { scope: ETHEREUM, address: '0xA' },
    { scope: BASE, address: '0xA' },
]

const markFailed = (scope: ChainScope, hasFailed: boolean) =>
    useHoldingsRefreshStore
        .getState()
        .setHoldingsRefreshFailed(scope, '0xA', hasFailed)

const markRead = (scope: ChainScope) =>
    useAccountChainStateStore.getState().setAccountChainState(scope, '0xA', {
        family: 'evm',
        nonce: { latest: 0, pending: 0 },
    })

describe('useFailedFirstReadChainIds', () => {
    beforeEach(() => {
        useHoldingsRefreshStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
    })

    it('lists a chain whose read failed before any read landed, and drops it once one does', () => {
        const { result } = renderHook(() => useFailedFirstReadChainIds(SOURCES))
        expect(result.current.size).toBe(0)

        act(() => markFailed(BASE, true))
        expect([...result.current]).toEqual(['base'])

        act(() => markRead(BASE))
        expect(result.current.size).toBe(0)
    })

    it('leaves out a chain whose balance was read but whose holdings refresh failed, as its zero is real', () => {
        markRead(ETHEREUM)
        markFailed(ETHEREUM, true)

        const { result } = renderHook(() => useFailedFirstReadChainIds(SOURCES))

        expect(result.current.size).toBe(0)
    })

    it('leaves out a chain never read, so a chain the build never reads cannot blank a total', () => {
        const { result } = renderHook(() => useFailedFirstReadChainIds(SOURCES))

        expect(result.current.size).toBe(0)
    })

    it('keeps the same set while no read changes', () => {
        markFailed(BASE, true)
        const { result, rerender } = renderHook(() =>
            useFailedFirstReadChainIds(SOURCES),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })
})
