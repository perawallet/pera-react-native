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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useSwapTrackingStore } from '@perawallet/wallet-core-swaps'
import { useSwapOrdersPaidInto } from '../useSwapOrdersPaidInto'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const order = (
    orderId: string,
    sourceScope: ChainScope,
    destinationScope: ChainScope,
) => ({ orderId, sourceScope, destinationScope })

const withOrders = (orders: ReturnType<typeof order>[]) => {
    const state = {
        orders: Object.fromEntries(orders.map(o => [o.orderId, o])),
    }
    vi.mocked(useSwapTrackingStore).mockImplementation(((
        selector: (s: typeof state) => unknown,
    ) => selector(state)) as never)
}

describe('useSwapOrdersPaidInto', () => {
    it('groups the orders paying out on the network by the network that paid them', () => {
        withOrders([
            order('a', ETHEREUM, BASE),
            order('b', ETHEREUM, BASE),
            order('c', ALGORAND, BASE),
            order('d', BASE, ETHEREUM),
            order('e', BASE, BASE),
        ])

        const { result } = renderHook(() => useSwapOrdersPaidInto(BASE))

        expect(result.current).toEqual([
            { scope: ETHEREUM, orderIds: new Set(['a', 'b']) },
            { scope: ALGORAND, orderIds: new Set(['c']) },
        ])
    })

    it('lists none under every network', () => {
        withOrders([order('a', ETHEREUM, BASE)])

        const { result } = renderHook(() => useSwapOrdersPaidInto(null))

        expect(result.current).toEqual([])
    })
})
